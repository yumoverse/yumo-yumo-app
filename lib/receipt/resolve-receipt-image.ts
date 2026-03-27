/**
 * Fiş görüntüsünü bulur: receipt_data (yüzeysel + gömülü URL), receipts.blob_url,
 * Vercel Blob head/list (pathname receipts/<id>.<ext>), receipt_upload_fallback, yerel uploads.
 */

import { promises as fs } from "fs";
import path from "path";

const FETCH_TIMEOUT_MS = 25_000;

const isVercelRuntime = process.env.VERCEL === "1" || process.cwd().startsWith("/var/task");
const DEFAULT_UPLOAD_DIR = isVercelRuntime
  ? path.join("/tmp", "uploads")
  : path.join(process.cwd(), ".data", "uploads");

let warnedNoBlobToken = false;
let loggedListHint = false;

function getVercelBlobToken(): string | null {
  const t = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return t || null;
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

function firstHttpUrlFromParsed(parsed: Record<string, unknown>): string | null {
  for (const key of ["blobUrl", "blob_url", "fullBlobUrl", "imageUrl"] as const) {
    const c = parsed[key];
    if (typeof c === "string" && c.trim().startsWith("http")) return c.trim();
  }
  const ev = parsed.evidence;
  if (ev && typeof ev === "object" && ev !== null) {
    const iu = (ev as Record<string, unknown>).imageUrl;
    if (typeof iu === "string" && iu.trim().startsWith("http")) return iu.trim();
  }
  return null;
}

/** receipt_data agacinda blob / goruntu URL (pipelineLog cok buyukse atlanir) */
function harvestEmbeddedImageUrls(receiptData: unknown): string[] {
  const found = new Set<string>();

  function consider(s: string) {
    const t = s.trim();
    if (!t.startsWith("http")) return;
    if (t.includes("blob.vercel-storage.com")) {
      found.add(t.split(/[\s"'<>]/)[0] ?? t);
      return;
    }
    if (/\.(jpe?g|png|webp|gif|heic|heif)(\?|$)/i.test(t)) {
      found.add(t.split(/[\s"'<>]/)[0] ?? t);
    }
  }

  function walk(obj: unknown, depth: number): void {
    if (depth > 22 || found.size >= 24) return;
    if (typeof obj === "string") {
      const slice = obj.length > 12_000 ? obj.slice(0, 12_000) : obj;
      consider(slice);
      return;
    }
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const x of obj) {
        walk(x, depth + 1);
        if (found.size >= 24) break;
      }
      return;
    }
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === "pipelineLog" && typeof v === "string" && v.length > 120_000) continue;
      walk(v, depth + 1);
      if (found.size >= 24) break;
    }
  }

  walk(receiptData, 0);
  return [...found];
}

async function fetchUrlToBuffer(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 64) throw new Error("Dosya cok kucuk veya bos");
    return buf;
  } finally {
    clearTimeout(t);
  }
}

export type ReceiptImageSource =
  | "receipt_data_url"
  | "receipt_data_embedded_url"
  | "receipts_column_blob_url"
  | "vercel_blob_head"
  | "vercel_blob_list"
  | "neon_fallback"
  | "local_uploads";

export type ResolvedReceiptImage = {
  buffer: Buffer;
  source: ReceiptImageSource;
  /** Indirilen / listelenen HTTP adresi — receipt_data.blobUrl doldurmak icin */
  publicUrl?: string;
};

const BLOB_EXTENSIONS = ["jpg", "jpeg", "JPG", "JPEG", "png", "PNG", "webp", "gif", "heic", "heif"] as const;

function isBlobNotFound(e: unknown): boolean {
  if (e === null || typeof e !== "object") return false;
  const ctor = (e as { constructor?: { name?: string } }).constructor?.name;
  /** @vercel/blob not-found uses constructor name; .name alani genelde "Error" */
  return ctor === "BlobNotFoundError";
}

async function tryVercelBlobByHeadAndList(
  receiptId: string,
  token: string
): Promise<ResolvedReceiptImage | null> {
  const { head, list } = await import("@vercel/blob");
  let headNon404: string | null = null;

  for (const ext of BLOB_EXTENSIONS) {
    const pathname = `receipts/${receiptId}.${ext}`;
    try {
      const meta = await head(pathname, { token });
      if (meta?.url) {
        const buffer = await fetchUrlToBuffer(meta.url);
        return { buffer, source: "vercel_blob_head", publicUrl: meta.url };
      }
    } catch (e: unknown) {
      if (!isBlobNotFound(e) && !headNon404) {
        headNon404 = (e as Error)?.message ?? String(e);
      }
    }
  }

  try {
    const { blobs } = await list({ prefix: `receipts/${receiptId}`, token });
    const blob = blobs.find((b) => b.pathname && !b.pathname.includes(".full.")) ?? blobs[0];
    if (blob?.url) {
      const buffer = await fetchUrlToBuffer(blob.url);
      return { buffer, source: "vercel_blob_list", publicUrl: blob.url };
    }
    if (!loggedListHint) {
      loggedListHint = true;
      const hint =
        blobs.length === 0
          ? `Vercel Blob: prefix=receipts/${receiptId} sonuc yok. Uretimde VERCEL=1 ile yukleme yapilmadiysa dosya sadece sunucu diski/Neon'da olabilir; .env BLOB_READ_WRITE_TOKEN ayni Vercel store olmali.`
          : "";
      if (hint) console.warn(`[resolveReceiptImage] ${hint}`);
      if (headNon404) {
        console.warn("[resolveReceiptImage] Vercel head (ornek):", headNon404);
      }
    }
  } catch (e) {
    console.warn(`[resolveReceiptImage] Vercel list ${receiptId}:`, (e as Error)?.message ?? e);
  }

  return null;
}

export async function resolveReceiptImageBuffer(opts: {
  receiptId: string;
  receiptData: unknown;
  dbBlobUrl?: string | null;
  uploadDir?: string;
}): Promise<ResolvedReceiptImage | null> {
  const { receiptId, receiptData, dbBlobUrl } = opts;
  const uploadDir = opts.uploadDir ?? DEFAULT_UPLOAD_DIR;
  const parsed = parseReceiptData(receiptData);

  const tryUrls: Array<{ url: string; source: ReceiptImageSource }> = [];
  const top = firstHttpUrlFromParsed(parsed);
  if (top) tryUrls.push({ url: top, source: "receipt_data_url" });
  for (const u of harvestEmbeddedImageUrls(receiptData)) {
    if (!tryUrls.some((x) => x.url === u)) tryUrls.push({ url: u, source: "receipt_data_embedded_url" });
  }
  const col = dbBlobUrl && String(dbBlobUrl).trim().startsWith("http") ? String(dbBlobUrl).trim() : null;
  if (col && !tryUrls.some((x) => x.url === col)) {
    tryUrls.push({ url: col, source: "receipts_column_blob_url" });
  }

  for (const { url, source } of tryUrls) {
    try {
      const buffer = await fetchUrlToBuffer(url);
      return { buffer, source, publicUrl: url };
    } catch {
      /* next */
    }
  }

  const token = getVercelBlobToken();
  if (token) {
    const fromBlob = await tryVercelBlobByHeadAndList(receiptId, token);
    if (fromBlob) return fromBlob;
  } else if (!warnedNoBlobToken) {
    warnedNoBlobToken = true;
    console.warn(
      "[resolveReceiptImage] BLOB_READ_WRITE_TOKEN yok — Vercel Blob head/list atlaniyor."
    );
  }

  if (process.env.DATABASE_URL) {
    try {
      const { db } = await import("@/lib/db/client");
      const { rows } = await db.query<{ image_data: Buffer }>(
        "SELECT image_data FROM receipt_upload_fallback WHERE receipt_id = $1 LIMIT 1",
        [receiptId]
      );
      if (rows.length > 0 && rows[0].image_data) {
        const raw = rows[0].image_data;
        const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
        if (buffer.length >= 64) return { buffer, source: "neon_fallback" };
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const files = await fs.readdir(uploadDir);
    const file = files.find((f) => f.startsWith(receiptId) && !f.includes(".full."));
    if (file) {
      const buffer = await fs.readFile(path.join(uploadDir, file));
      if (buffer.length >= 64) return { buffer, source: "local_uploads" };
    }
  } catch {
    /* ignore */
  }

  return null;
}
