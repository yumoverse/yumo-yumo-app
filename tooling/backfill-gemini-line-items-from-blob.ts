/**
 * Blob URL → Gemini Vision → receipt_data.geminiLineItems → (isteğe bağlı) runPostProcess → receipt_line_items
 *
 * Gereksinimler: DATABASE_URL, GEMINI_API_KEY veya GOOGLE_GEMINI_API_KEY (.env.local proje kökünde; npm run ile cwd kök olmalı)
 *
 * Kullanım:
 *   npx tsx tooling/backfill-gemini-line-items-from-blob.ts --limit=5
 *   npx tsx tooling/backfill-gemini-line-items-from-blob.ts --on-date=2026-01-20 --limit=20 --dry-run
 *   npx tsx tooling/backfill-gemini-line-items-from-blob.ts --on-date=2026-01-20 --date-mode=either --limit=20 --dry-run
 *   npx tsx tooling/backfill-gemini-line-items-from-blob.ts --uploaded-on=2026-01-20 --limit=50
 *     → Sisteme yüklenme günü (created_at; varsayılan takvim: UTC) + blob URL
 *   npx tsx ... --uploaded-on=2026-01-20 --uploaded-tr
 *     → Aynı, takvim günü Europe/Istanbul (TR’de “20 Ocak” genelde bu)
 *   npx tsx ... --on-date=2026-01-20 --date-mode=created --created-at-tz=Europe/Istanbul
 *   npm run receipt:backfill-gemini-uploaded-jan20
 *   npx tsx tooling/backfill-gemini-line-items-from-blob.ts --stats --on-date=2026-01-20
 *   npx tsx tooling/backfill-gemini-line-items-from-blob.ts --stats-only --on-date=2026-01-20   (sadece sayim; Gemini gerekmez; --stats ile birlikte gerek yok)
 *   npx tsx tooling/backfill-gemini-line-items-from-blob.ts --stats-only --uploaded-on=2026-01-20
 *   npx tsx tooling/backfill-gemini-line-items-from-blob.ts --receipt-id=<uuid> --dry-run
 *   npx tsx tooling/backfill-gemini-line-items-from-blob.ts --limit=10 --no-post-process
 *
 * Tarih: --on-date=YYYY-MM-DD + --date-mode=
 *   extraction (varsayılan): sadece sütun extraction_date_value metninin ilk 10 karakteri
 *   created: yüklenme günü (created_at + --created-at-tz, varsayılan UTC)
 *   either: sütun VEYA receipt_data.extraction.date.value VEYA created_at UTC (önerilen: 0 sonuçta dene)
 *
 * Notlar:
 * - Görsel: receipt_data URL, receipts.blob_url (sütun varsa), Vercel Blob listesi (BLOB_READ_WRITE_TOKEN),
 *   receipt_upload_fallback, .data/uploads — analyze file-loader ile uyumlu.
 * - Vercel Blob URL'leri genelde herkese açık okunur; 403 alırsanız URL/token politikasına bakın.
 * - PDF blob'ları bu script JPEG'e çevirmez; yalnızca görüntü dosyaları için uygundur.
 * - post-process için Vision JSON yoksa bile Gemini satırlarıyla tablo doldurulabilir.
 */

import path from "path";
import { config as loadEnv } from "dotenv";
import { analyzeWithGemini } from "@/app/api/receipt/analyze/services/gemini-vision-service";
import type { ReceiptContext } from "@/app/api/receipt/analyze/types";
import { resolveReceiptImageBuffer } from "@/lib/receipt/resolve-receipt-image";

function loadLocalEnv(): void {
  // tsx ile çalışırken Next .env.local yüklemez
  loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
  loadEnv();
}

/**
 * Istatistik: receipt_data icinde http goruntu URL (script ayrica Vercel/Neon/yerel dener).
 */
const RECEIPT_BLOB_URL_SQL = `NULLIF(TRIM(COALESCE(
  receipt_data->>'blobUrl',
  receipt_data->>'blob_url',
  receipt_data->>'fullBlobUrl',
  receipt_data->>'imageUrl',
  receipt_data->'evidence'->>'imageUrl'
)), '')`;

/** Tarih: --date-mode=either ile ayni mantik ($1 = YYYY-MM-DD) */
function sqlDateEitherClause(): string {
  return `(
    (extraction_date_value IS NOT NULL
      AND LEFT(TRIM(extraction_date_value::text), 10) = $1)
    OR (LEFT(TRIM(COALESCE(receipt_data->'extraction'->'date'->>'value', '')), 10) = $1)
    OR (to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') = $1)
  )`;
}

function arg(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`${name}=`));
  return p ? p.slice(name.length + 1) : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

/**
 * AT TIME ZONE '...' içine güvenle gömülebilir IANA bölgesi (enjeksiyon önlemi).
 */
function assertSafeIanaZoneForSql(raw: string): string {
  const z = raw.trim() || "UTC";
  if (z === "UTC" || z === "GMT") return "UTC";
  if (!/^[\w/+-]+$/.test(z) || z.length > 80) {
    console.error("[backfill] --created-at-tz gecersiz (ornek: Europe/Istanbul, UTC)");
    process.exit(1);
  }
  return z.replace(/'/g, "''");
}

function sqlCreatedLocalDayEquals(onDateParamIndex: number, tzSqlLiteral: string): string {
  return `to_char(created_at AT TIME ZONE '${tzSqlLiteral}', 'YYYY-MM-DD') = $${onDateParamIndex}`;
}

/** Fiş tarihi filtresi: YYYY-MM-DD */
function parseOnDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    console.error("[backfill] --on-date YYYY-MM-DD formatında olmalı (örn. 2026-01-20).");
    process.exit(1);
  }
  const t = Date.parse(`${s}T12:00:00Z`);
  if (Number.isNaN(t)) {
    console.error("[backfill] Geçersiz takvim tarihi:", s);
    process.exit(1);
  }
  return s;
}

type DateMode = "extraction" | "created" | "either";

function parseDateMode(raw: string | undefined): DateMode {
  const v = (raw || "extraction").trim().toLowerCase();
  if (v === "extraction" || v === "created" || v === "either") return v;
  console.error("[backfill] --date-mode extraction | created | either olmalı.");
  process.exit(1);
}

/** Tarih filtresi; $1 = onDate (YYYY-MM-DD). Cast yok (bozuk OCR tarihleri). */
function sqlDateClause(
  mode: DateMode,
  onDate: string | null,
  createdTzSqlLiteral: string
): string {
  if (!onDate) return "";
  if (mode === "extraction") {
    return `AND extraction_date_value IS NOT NULL
            AND LEFT(TRIM(extraction_date_value::text), 10) = $1`;
  }
  if (mode === "created") {
    return `AND ${sqlCreatedLocalDayEquals(1, createdTzSqlLiteral)}`;
  }
  // either
  return `AND ${sqlDateEitherClause()}`;
}

/** Sisteme yukleme gunu (created_at UTC) + blob + geminiLineItems dolu */
async function printUploadDateDiagnostics(
  db: { query: <T>(q: string, p?: unknown[]) => Promise<{ rows: T[] }> },
  blobExpr: string,
  onDate: string,
  tzLabel: string,
  tzSqlLiteral: string
): Promise<void> {
  const b = blobExpr.trim();
  const day = sqlCreatedLocalDayEquals(1, tzSqlLiteral);
  const row = await db.query<{
    n_created: string;
    n_blob: string;
    n_gemini_lines: string;
  }>(
    `SELECT
      (SELECT COUNT(*)::text FROM receipts WHERE ${day}) AS n_created,
      (SELECT COUNT(*)::text FROM receipts
        WHERE ${day}
        AND (${b}) IS NOT NULL) AS n_blob,
      (SELECT COUNT(*)::text FROM receipts
        WHERE ${day}
        AND (${b}) IS NOT NULL
        AND jsonb_typeof(receipt_data->'geminiLineItems') = 'array'
        AND jsonb_array_length(COALESCE(receipt_data->'geminiLineItems', '[]'::jsonb)) > 0) AS n_gemini_lines`,
    [onDate]
  );
  const r = row.rows[0];
  console.log(`[backfill] Yukleme gunu (${tzLabel}) ${onDate}:`);
  console.log(
    `[backfill]   o gun yuklenen fiş: ${r?.n_created ?? "?"}, JSON'da http URL: ${r?.n_blob ?? "?"}, geminiLineItems dolu: ${r?.n_gemini_lines ?? "?"}`
  );
  console.log(
    "[backfill]   Islem sirasi: JSON/DB URL, sonra Vercel list(receipts/<id>), Neon fallback, yerel uploads."
  );
}

async function printDateDiagnostics(
  db: { query: <T>(q: string, p?: unknown[]) => Promise<{ rows: T[] }> },
  blobExpr: string,
  onDate: string
): Promise<void> {
  const b = blobExpr.trim();
  const d = sqlDateEitherClause();

  const row = await db.query<{
    n_blob: string;
    n_date: string;
    n_backfill: string;
    n_ext_only: string;
    n_json_only: string;
    n_created_only: string;
  }>(
    `SELECT
      (SELECT COUNT(*)::text FROM receipts WHERE (${b}) IS NOT NULL) AS n_blob,
      (SELECT COUNT(*)::text FROM receipts WHERE ${d}) AS n_date,
      (SELECT COUNT(*)::text FROM receipts WHERE (${b}) IS NOT NULL AND ${d}) AS n_backfill,
      (SELECT COUNT(*)::text FROM receipts WHERE (${b}) IS NOT NULL
         AND extraction_date_value IS NOT NULL
         AND LEFT(TRIM(extraction_date_value::text), 10) = $1) AS n_ext_only,
      (SELECT COUNT(*)::text FROM receipts WHERE (${b}) IS NOT NULL
         AND LEFT(TRIM(COALESCE(receipt_data->'extraction'->'date'->>'value', '')), 10) = $1) AS n_json_only,
      (SELECT COUNT(*)::text FROM receipts WHERE (${b}) IS NOT NULL
         AND to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') = $1) AS n_created_only`,
    [onDate]
  );

  const r = row.rows[0];
  const nBlob = parseInt(r?.n_blob ?? "0", 10);
  const nDate = parseInt(r?.n_date ?? "0", 10);
  const nBack = parseInt(r?.n_backfill ?? "0", 10);
  const nExt = parseInt(r?.n_ext_only ?? "0", 10);
  const nJson = parseInt(r?.n_json_only ?? "0", 10);
  const nCre = parseInt(r?.n_created_only ?? "0", 10);

  console.log(`[backfill] --stats ${onDate} (tek snapshot):`);
  console.log(`[backfill]   goruntu URL (JSON): ${nBlob}  |  tarih either (blob sart yok): ${nDate}`);
  console.log(`[backfill]   backfill aday (URL + tarih either): ${nBack}`);
  console.log(
    `[backfill]   URL varken tarih kaynagi: extraction_sutun=${nExt}, receipt_data.extraction.date=${nJson}, created_utc=${nCre}`
  );
}

function parseReceiptData(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return { ...(raw as Record<string, unknown>) };
  return {};
}

type BackfillRow = {
  receipt_id: string;
  merchant_country: string | null;
  receipt_data: unknown;
  db_blob_url: string | null;
};

async function loadBackfillRows(
  db: { query: <T>(q: string, p?: unknown[]) => Promise<{ rows: T[] }> },
  opts: { singleId?: string; onDate: string | null; dateClause: string; limit: number }
): Promise<BackfillRow[]> {
  const { singleId, onDate, dateClause, limit } = opts;
  const blobExpr = RECEIPT_BLOB_URL_SQL;

  if (singleId) {
    try {
      const r = await db.query<BackfillRow>(
        `SELECT receipt_id, receipt_data, merchant_country, blob_url AS db_blob_url
         FROM receipts WHERE receipt_id = $1 LIMIT 1`,
        [singleId]
      );
      return r.rows;
    } catch (e) {
      if (!/blob_url/i.test(String((e as Error).message))) throw e;
      const r = await db.query<BackfillRow>(
        `SELECT receipt_id, receipt_data, merchant_country, NULL::text AS db_blob_url
         FROM receipts WHERE receipt_id = $1 LIMIT 1`,
        [singleId]
      );
      return r.rows;
    }
  }

  if (onDate) {
    const qWith = `SELECT receipt_id, receipt_data, merchant_country, blob_url AS db_blob_url
       FROM receipts WHERE 1=1 ${dateClause}
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT $2`;
    const qWithout = `SELECT receipt_id, receipt_data, merchant_country, NULL::text AS db_blob_url
       FROM receipts WHERE 1=1 ${dateClause}
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT $2`;
    try {
      return (await db.query<BackfillRow>(qWith, [onDate, limit])).rows;
    } catch (e) {
      if (!/blob_url/i.test(String((e as Error).message))) throw e;
      return (await db.query<BackfillRow>(qWithout, [onDate, limit])).rows;
    }
  }

  const qLatestWith = `SELECT receipt_id, receipt_data, merchant_country, blob_url AS db_blob_url
     FROM receipts WHERE ${blobExpr} IS NOT NULL
     ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT $1`;
  const qLatestWithout = `SELECT receipt_id, receipt_data, merchant_country, NULL::text AS db_blob_url
     FROM receipts WHERE ${blobExpr} IS NOT NULL
     ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT $1`;
  try {
    return (await db.query<BackfillRow>(qLatestWith, [limit])).rows;
  } catch (e) {
    if (!/blob_url/i.test(String((e as Error).message))) throw e;
    return (await db.query<BackfillRow>(qLatestWithout, [limit])).rows;
  }
}

function minimalContext(
  receiptId: string,
  userCountry: string,
  base64Image: string
): ReceiptContext {
  return {
    receiptId,
    username: "backfill-gemini-script",
    userCountry: userCountry || "TR",
    isAdmin: true,
    base64Image,
    ocrLines: [],
    fullText: "",
    totalPaid: 0,
    vatAmount: 0,
    currency: "TRY",
    currencySymbol: "₺",
    startTime: Date.now(),
  };
}

async function main() {
  loadLocalEnv();

  const dryRun = hasFlag("--dry-run");
  const noPost = hasFlag("--no-post-process");
  const limit = Math.min(500, Math.max(1, parseInt(arg("--limit") || "5", 10)));
  const singleId = arg("--receipt-id")?.trim();
  const uploadedOn = parseOnDate(arg("--uploaded-on"));
  let onDate = parseOnDate(arg("--on-date"));
  let dateMode = parseDateMode(arg("--date-mode"));
  const uploadedTr = hasFlag("--uploaded-tr");
  const createdAtTzRaw = uploadedTr ? "Europe/Istanbul" : (arg("--created-at-tz")?.trim() || "UTC");
  const createdTzSqlLiteral = assertSafeIanaZoneForSql(createdAtTzRaw);

  if (uploadedOn) {
    if (onDate && onDate !== uploadedOn) {
      console.warn(`[backfill] --uploaded-on=${uploadedOn} kullanildi; --on-date=${onDate} yok sayildi.`);
    }
    onDate = uploadedOn;
    dateMode = "created";
    console.log(
      `[backfill] Mod: sisteme yukleme gunu (created_at → takvim ${createdAtTzRaw}) — fiş tarihi degil.`
    );
  }
  const wantStats = hasFlag("--stats");

  if (!process.env.DATABASE_URL) {
    console.error(
      "[backfill] DATABASE_URL yok. Proje kökünde .env.local içinde tanımlı olmalı (tsx Next kadar otomatik yüklemez)."
    );
    process.exit(1);
  }

  const statsOnly = hasFlag("--stats-only");
  if (!statsOnly && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_GEMINI_API_KEY) {
    console.error("[backfill] GEMINI_API_KEY veya GOOGLE_GEMINI_API_KEY yok.");
    process.exit(1);
  }

  const { db, getSql } = await import("@/lib/db/client");
  const { runPostProcess } = await import("@/lib/receipt/post-process/run-post-process");

  if (onDate && (wantStats || statsOnly)) {
    if (dateMode === "created") {
      await printUploadDateDiagnostics(
        db,
        RECEIPT_BLOB_URL_SQL,
        onDate,
        createdAtTzRaw,
        createdTzSqlLiteral
      );
    } else {
      await printDateDiagnostics(db, RECEIPT_BLOB_URL_SQL, onDate);
    }
  }
  if (statsOnly) {
    if (!onDate) console.warn("[backfill] --stats-only icin --on-date=YYYY-MM-DD onerilir.");
    return;
  }

  const dateClause = sqlDateClause(dateMode, onDate, createdTzSqlLiteral);

  let rows: BackfillRow[] = await loadBackfillRows(db, {
    singleId: singleId || undefined,
    onDate,
    dateClause,
    limit,
  });

  if (singleId && rows.length === 0) {
    console.error("[backfill] Fiş bulunamadı:", singleId);
    process.exit(1);
  }

  if (rows.length === 0 && onDate && !singleId) {
    console.log(`[backfill] 0 kayit (tarih filtresine uyan fiş yok). Tarih modu: ${dateMode}.`);
    if (dateMode === "created") {
      await printUploadDateDiagnostics(
        db,
        RECEIPT_BLOB_URL_SQL,
        onDate,
        createdAtTzRaw,
        createdTzSqlLiteral
      );
      if (createdAtTzRaw === "UTC") {
        console.log(
          "[backfill] Ipucu: TR'de gece yarimdan sonra yuklemeler UTC'de bir sonraki gune duser. Dene: --uploaded-tr"
        );
      }
      console.log(
        `[backfill] Fiş baskı tarihine gore aramak: --on-date=${onDate} --date-mode=either --stats`
      );
    } else {
      console.log(
        `[backfill] Dene: --date-mode=either veya --stats --on-date=${onDate}`
      );
    }
  }

  console.log(
    `[backfill] ${rows.length} fiş işlenecek. onDate=${onDate ?? "(yok)"} dateMode=${onDate ? dateMode : "-"} dryRun=${dryRun} noPostProcess=${noPost}`
  );

  const sql = getSql();
  if (!sql && !dryRun) {
    console.error("[backfill] getSql() null (DATABASE_URL?).");
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    const id = row.receipt_id;

    try {
      const resolved = await resolveReceiptImageBuffer({
        receiptId: id,
        receiptData: row.receipt_data,
        dbBlobUrl: row.db_blob_url,
      });
      if (!resolved) {
        console.warn(
          `[backfill] SKIP ${id}: goruntu bulunamadi (JSON URL, Vercel list, Neon fallback, .data/uploads)`
        );
        fail++;
        continue;
      }

      console.log(`[backfill] ${id} goruntu kaynagi=${resolved.source}`);
      const b64 = resolved.buffer.toString("base64");

      const gemini = await analyzeWithGemini(
        minimalContext(id, row.merchant_country || "TR", b64)
      );

      if (!gemini) {
        console.warn(`[backfill] SKIP ${id}: Gemini null döndü`);
        fail++;
        continue;
      }

      const lines = gemini.lineItems?.length ?? 0;
      console.log(`[backfill] ${id}: Gemini lineItems=${lines}`);

      const merged = parseReceiptData(row.receipt_data);
      merged.geminiLineItems = gemini.lineItems;
      merged.geminiBackfilledAt = new Date().toISOString();
      const existingBlob = merged.blobUrl;
      if (
        resolved.publicUrl &&
        (typeof existingBlob !== "string" || !existingBlob.startsWith("http"))
      ) {
        merged.blobUrl = resolved.publicUrl;
      }

      if (dryRun) {
        console.log(`[backfill] DRY-RUN ${id}: örnek satır`, gemini.lineItems?.[0] ?? "(yok)");
        ok++;
        continue;
      }

      await sql!`
        UPDATE receipts
        SET receipt_data = ${JSON.stringify(merged)}::jsonb,
            post_process_state = 'pending',
            post_process_started_at = NULL
        WHERE receipt_id = ${id}
      `;

      if (!noPost) {
        const pp = await runPostProcess(id);
        console.log(`[backfill] ${id}: post-process`, pp);
        if (!pp.ok) fail++;
        else ok++;
      } else {
        ok++;
      }
    } catch (e) {
      fail++;
      console.error(`[backfill] ERR ${id}:`, (e as Error)?.message ?? e);
    }
  }

  console.log(`[backfill] Bitti. ok≈${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
