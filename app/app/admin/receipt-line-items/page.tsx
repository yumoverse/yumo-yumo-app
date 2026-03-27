"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { Loader2, Search, X, RotateCcw, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { useAppProfile } from "@/lib/app/profile-context";

const PAGE_SIZE = 100;

// ─── Types ───────────────────────────────────────────────────────────────────

interface LineItemRow {
  id: number;
  receiptId: string;
  merchantName: string | null;
  merchantCountry: string | null;
  merchantAddress: string | null;
  branchInfo: string | null;
  merchantCity: string | null;
  merchantDistrict: string | null;
  merchantNeighborhood: string | null;
  extractionDate: string | null;
  systemAddedAt: string | null;
  rawName: string | null;
  brand: string | null;
  canonicalName: string | null;
  categoryLvl1: string | null;
  categoryLvl2: string | null;
  quantity: number;
  unitType: string | null;
  unitPriceGross: number | null;
  lineTotalGross: number | null;
  confidenceScore: number | null;
}

interface Stats {
  totalItems: number;
  receiptsWithItems: number;
  itemsWithBrand: number;
  itemsWithCanonical: number;
  receiptsWithAddress: number;
  itemsWithCategory: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, locale = "tr-TR"): string {
  if (n == null) return "—";
  return n.toLocaleString(locale, { maximumFractionDigits: 2 });
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "2-digit" });
  } catch {
    return iso.slice(0, 10);
  }
}

function shortId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 7)}…${id.slice(-5)}` : id;
}

function pct(a: number, b: number): string {
  if (!b) return "—";
  return `${Math.round((a / b) * 100)}%`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: "var(--app-bg-elevated)", border: "1px solid var(--app-border)" }}
    >
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--app-text-muted)" }}>
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--app-text-primary)" }}>
        {value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: "var(--app-text-muted)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function ConfidenceDot({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: "var(--app-text-muted)" }}>—</span>;
  const color =
    score >= 0.85 ? "#22c55e" :
    score >= 0.6  ? "#f59e0b" :
    "#ef4444";
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-sm" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {score.toFixed(2)}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminReceiptLineItemsPage() {
  const router = useRouter();
  const { profile } = useAppProfile();
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<LineItemRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [activeQ, setActiveQ] = useState("");
  const [offset, setOffset] = useState(0);

  // Reprocess / backfill state
  const [reprocessId, setReprocessId] = useState("");
  const [reprocessBusy, setReprocessBusy] = useState(false);
  const [reprocessMsg, setReprocessMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsAdmin(!!profile?.isAdmin);
  }, [profile?.isAdmin]);

  const load = async (q: string, off: number) => {
    if (!profile?.isAdmin) return;
    setIsLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
      if (q) p.set("q", q);
      const res = await fetch(`/api/admin/receipt-line-items?${p}`);
      if (!res.ok) throw new Error(res.status === 403 ? "Yetkisiz." : "Veri yüklenemedi.");
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    load(activeQ, offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeQ, offset]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    setActiveQ(q);
    setOffset(0);
  };

  const clearSearch = () => {
    setSearchInput("");
    setActiveQ("");
    setOffset(0);
    searchRef.current?.focus();
  };

  const handleReprocess = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = reprocessId.trim();
    if (!id) return;
    setReprocessBusy(true);
    setReprocessMsg(null);
    try {
      const res = await fetch("/api/admin/receipt-line-items/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReprocessMsg({ ok: false, text: data.error || `Hata ${res.status}` });
        return;
      }
      setReprocessMsg({
        ok: data.ok,
        text: data.ok
          ? `Tamamlandı · state=${data.state}`
          : `Bitti · state=${data.state}${data.error ? ` — ${data.error}` : ""}`,
      });
      load(activeQ, offset);
    } catch {
      setReprocessMsg({ ok: false, text: "İstek başarısız." });
    } finally {
      setReprocessBusy(false);
    }
  };

  const handleBackfill = async () => {
    setBackfillBusy(true);
    setBackfillMsg(null);
    try {
      const res = await fetch("/api/admin/receipt-line-items/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 25 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBackfillMsg({ ok: false, text: data.error || `Hata ${res.status}` });
        return;
      }
      const lines: number = typeof data.totalLineItemsWritten === "number" ? data.totalLineItemsWritten : 0;
      const found: number = data.found ?? 0;
      setBackfillMsg({
        ok: lines > 0,
        text: lines > 0
          ? `${lines} ürün satırı yazıldı — ${found} fiş işlendi.`
          : `${found} fiş işlendi, satır yazılamadı. receipt_data'da LLM çıktısı yok; yeniden analiz gerekebilir.`,
      });
      load(activeQ, offset);
    } catch {
      setBackfillMsg({ ok: false, text: "İstek başarısız." });
    } finally {
      setBackfillBusy(false);
    }
  };

  // ── Guard ────────────────────────────────────────────────────────────────────

  const shellWide = "max-w-none lg:max-w-none w-full mx-0 sm:px-4 lg:px-6";

  if (!isAdmin && !isLoading) {
    return (
      <AppShell className={shellWide}>
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <p className="text-lg font-medium" style={{ color: "var(--app-text-muted)" }}>
            Bu sayfaya sadece admin erişebilir.
          </p>
          <button
            onClick={() => router.push("/app/dashboard")}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--app-bg-elevated)", border: "1px solid var(--app-border)", color: "var(--app-text-primary)" }}
          >
            Dashboard'a dön
          </button>
        </div>
      </AppShell>
    );
  }

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppShell className={shellWide}>
      <div className="space-y-6 pb-20 w-full min-w-0">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold" style={{ color: "var(--app-text-primary)" }}>
            Fiş Satırları
          </h1>
          <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
            receipt_line_items · canonical pipeline çıktısı
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Toplam satır" value={stats.totalItems.toLocaleString("tr-TR")} />
            <StatCard label="Satırlı fiş" value={stats.receiptsWithItems.toLocaleString("tr-TR")} />
            <StatCard
              label="Marka dolu"
              value={stats.itemsWithBrand.toLocaleString("tr-TR")}
              sub={`${pct(stats.itemsWithBrand, stats.totalItems)} satır`}
            />
            <StatCard
              label="Kategori var"
              value={(stats.itemsWithCategory ?? 0).toLocaleString("tr-TR")}
              sub={`${pct(stats.itemsWithCategory ?? 0, stats.totalItems)} satır`}
            />
            <StatCard
              label="Adres var"
              value={stats.receiptsWithAddress.toLocaleString("tr-TR")}
              sub={`${pct(stats.receiptsWithAddress, stats.receiptsWithItems)} fiş`}
            />
            <StatCard
              label="Canonical eşleşti"
              value={stats.itemsWithCanonical.toLocaleString("tr-TR")}
              sub={`${pct(stats.itemsWithCanonical, stats.totalItems)} satır`}
            />
          </div>
        )}

        {/* Actions */}
        <div
          className="rounded-xl p-4 flex flex-col sm:flex-row gap-4 sm:items-start"
          style={{ background: "var(--app-bg-elevated)", border: "1px solid var(--app-border)" }}
        >
          {/* Backfill */}
          <div className="flex flex-col gap-2 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--app-text-muted)" }}>
              Toplu post-process
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleBackfill}
                disabled={backfillBusy}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
                style={{
                  background: "var(--app-primary)",
                  color: "#fff",
                }}
              >
                {backfillBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Satırı olmayan fişleri işle (25)
              </button>
              <span className="text-xs" style={{ color: "var(--app-text-muted)" }}>
                LLM çağrısı yok — DB'deki analiz çıktısı kullanılır.
              </span>
            </div>
            {backfillMsg && (
              <p
                className="text-xs rounded-lg px-3 py-2"
                style={{
                  background: backfillMsg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  color: backfillMsg.ok ? "#22c55e" : "#ef4444",
                  border: `1px solid ${backfillMsg.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                }}
              >
                {backfillMsg.text}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px self-stretch" style={{ background: "var(--app-border)" }} />

          {/* Single reprocess */}
          <div className="flex flex-col gap-2 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--app-text-muted)" }}>
              Tek fiş
            </p>
            <form onSubmit={handleReprocess} className="flex gap-2">
              <input
                placeholder="receipt_id"
                value={reprocessId}
                onChange={(e) => setReprocessId(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-sm font-mono min-w-0 outline-none focus:ring-1"
                style={{
                  background: "var(--app-bg)",
                  border: "1px solid var(--app-border)",
                  color: "var(--app-text-primary)",
                  "--tw-ring-color": "var(--app-primary)",
                } as React.CSSProperties}
              />
              <button
                type="submit"
                disabled={reprocessBusy || !reprocessId.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-opacity disabled:opacity-50 shrink-0"
                style={{ background: "var(--app-bg-elevated)", border: "1px solid var(--app-border)", color: "var(--app-text-primary)" }}
              >
                {reprocessBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                İşle
              </button>
            </form>
            {reprocessMsg && (
              <p
                className="text-xs rounded-lg px-3 py-2"
                style={{
                  background: reprocessMsg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  color: reprocessMsg.ok ? "#22c55e" : "#ef4444",
                  border: `1px solid ${reprocessMsg.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                }}
              >
                {reprocessMsg.text}
              </p>
            )}
          </div>
        </div>

        {/* Search + Pagination header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <form onSubmit={handleSearch} className="relative flex items-center gap-2 flex-1 max-w-md">
            <Search className="absolute left-3 h-4 w-4 pointer-events-none" style={{ color: "var(--app-text-muted)" }} />
            <input
              ref={searchRef}
              placeholder="Ürün, marka, işletme, fiş ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg pl-9 pr-8 py-2 text-sm outline-none focus:ring-1"
              style={{
                background: "var(--app-bg-elevated)",
                border: "1px solid var(--app-border)",
                color: "var(--app-text-primary)",
                "--tw-ring-color": "var(--app-primary)",
              } as React.CSSProperties}
            />
            {(searchInput || activeQ) && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2.5"
                style={{ color: "var(--app-text-muted)" }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          <div className="flex items-center gap-2 text-sm shrink-0">
            <span style={{ color: "var(--app-text-muted)" }}>
              {total > 0 ? `${from}–${to} / ${total.toLocaleString("tr-TR")}` : "0 kayıt"}
            </span>
            <button
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              disabled={!hasPrev || isLoading}
              className="p-1.5 rounded-lg disabled:opacity-30"
              style={{ background: "var(--app-bg-elevated)", border: "1px solid var(--app-border)", color: "var(--app-text-primary)" }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              disabled={!hasNext || isLoading}
              className="p-1.5 rounded-lg disabled:opacity-30"
              style={{ background: "var(--app-bg-elevated)", border: "1px solid var(--app-border)", color: "var(--app-text-primary)" }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => load(activeQ, offset)}
              disabled={isLoading}
              className="p-1.5 rounded-lg disabled:opacity-30"
              style={{ background: "var(--app-bg-elevated)", border: "1px solid var(--app-border)", color: "var(--app-text-primary)" }}
              title="Yenile"
            >
              <RotateCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
          >
            {error}
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--app-text-muted)" }} />
          </div>
        ) : items.length === 0 ? (
          <div
            className="rounded-xl flex flex-col items-center justify-center py-16 gap-3"
            style={{ background: "var(--app-bg-elevated)", border: "1px solid var(--app-border)" }}
          >
            <p className="font-medium" style={{ color: "var(--app-text-primary)" }}>
              {activeQ ? "Arama sonucu yok" : "Henüz satır yok"}
            </p>
            <p className="text-sm text-center max-w-sm" style={{ color: "var(--app-text-muted)" }}>
              {activeQ
                ? "Farklı anahtar kelime dene veya filtreyi temizle."
                : "Yukarıdan «Satırı olmayan fişleri işle» ile post-process başlat."}
            </p>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden w-full min-w-0"
            style={{ border: "1px solid var(--app-border)" }}
          >
            <table className="w-full min-w-0 table-fixed border-collapse text-xs">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[9%]" />
                <col className="w-[12%]" />
                <col className="w-[5%]" />
                <col className="w-[13%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[11%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[7%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead>
                <tr style={{ background: "var(--app-bg-elevated)", borderBottom: "1px solid var(--app-border)" }}>
                  {["Fiş", "İşletme", "Adres", "Tarih", "Ham ad", "Marka", "Canonical", "Kategori", "Miktar", "Birim", "Toplam", "Güven"].map((h) => (
                    <th
                      key={h}
                      className="px-1.5 py-2 text-left font-semibold uppercase tracking-wide leading-tight"
                      style={{ color: "var(--app-text-muted)", fontSize: "0.65rem" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={item.id}
                    className="transition-colors"
                    style={{
                      borderBottom: i < items.length - 1 ? "1px solid var(--app-border)" : undefined,
                      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--app-bg-elevated)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)")}
                  >
                    {/* Fiş ID */}
                    <td className="px-1.5 py-2 align-top min-w-0">
                      <Link
                        href={`/app/receipts/${encodeURIComponent(item.receiptId)}`}
                        className="inline-flex items-center gap-0.5 font-mono text-[0.65rem] hover:underline max-w-full min-w-0 truncate"
                        style={{ color: "var(--app-primary)" }}
                        title={item.receiptId}
                      >
                        <span className="truncate">{shortId(item.receiptId)}</span>
                        <ArrowUpRight className="h-3 w-3 shrink-0 opacity-60" />
                      </Link>
                    </td>

                    {/* İşletme / Şube */}
                    <td className="px-1.5 py-2 align-top min-w-0">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span
                          className="truncate text-[0.7rem] font-medium"
                          style={{ color: "var(--app-text-primary)" }}
                          title={item.merchantName ?? ""}
                        >
                          {item.merchantName ?? "—"}
                        </span>
                        {item.branchInfo && (
                          <span
                            className="truncate text-[0.65rem]"
                            style={{ color: "var(--app-primary)" }}
                            title={item.branchInfo}
                          >
                            {item.branchInfo}
                          </span>
                        )}
                        {item.merchantCountry && (
                          <span className="text-[0.65rem] font-mono truncate" style={{ color: "var(--app-text-muted)" }}>
                            {item.merchantCountry.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Adres */}
                    <td className="px-1.5 py-2 align-top min-w-0">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        {item.merchantAddress ? (
                          <span
                            className="text-[0.7rem] truncate block"
                            style={{ color: "var(--app-text-muted)", lineHeight: "1.35" }}
                            title={item.merchantAddress}
                          >
                            {item.merchantAddress}
                          </span>
                        ) : null}
                        {(item.merchantCity || item.merchantDistrict || item.merchantNeighborhood) ? (
                          <span
                            className="text-[0.65rem] font-medium truncate block"
                            style={{ color: "var(--app-text-primary)", opacity: 0.75 }}
                            title={[item.merchantNeighborhood, item.merchantDistrict, item.merchantCity].filter(Boolean).join(", ")}
                          >
                            {[item.merchantDistrict, item.merchantCity].filter(Boolean).join(" / ")}
                            {item.merchantNeighborhood ? (
                              <span className="ml-1 font-normal" style={{ color: "var(--app-text-muted)" }}>
                                {item.merchantNeighborhood}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        {!item.merchantAddress && !item.merchantCity && (
                          <span className="text-[0.7rem]" style={{ color: "var(--app-text-muted)", opacity: 0.4 }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* Tarih */}
                    <td className="px-1.5 py-2 align-top whitespace-nowrap">
                      <span className="text-[0.7rem]" style={{ color: "var(--app-text-muted)" }}>
                        {shortDate(item.extractionDate)}
                      </span>
                    </td>

                    {/* Ham ad */}
                    <td className="px-1.5 py-2 align-top min-w-0">
                      <span
                        className="block truncate text-[0.7rem] min-w-0"
                        style={{ color: "var(--app-text-primary)" }}
                        title={item.rawName ?? ""}
                      >
                        {item.rawName ?? "—"}
                      </span>
                    </td>

                    {/* Marka */}
                    <td className="px-1.5 py-2 align-top min-w-0">
                      {item.brand ? (
                        <span
                          className="inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[0.65rem] font-medium align-top"
                          style={{
                            background: "rgba(var(--app-primary-rgb, 99,102,241),0.12)",
                            color: "var(--app-primary)",
                            border: "1px solid rgba(var(--app-primary-rgb, 99,102,241),0.2)",
                          }}
                          title={item.brand}
                        >
                          {item.brand}
                        </span>
                      ) : (
                        <span className="text-[0.7rem]" style={{ color: "var(--app-text-muted)" }}>—</span>
                      )}
                    </td>

                    {/* Canonical */}
                    <td className="px-1.5 py-2 align-top min-w-0">
                      <span
                        className="block truncate text-[0.7rem] min-w-0"
                        style={{ color: "var(--app-text-muted)" }}
                        title={item.canonicalName ?? ""}
                      >
                        {item.canonicalName ?? "—"}
                      </span>
                    </td>

                    {/* Kategori */}
                    <td className="px-1.5 py-2 align-top min-w-0">
                      {item.categoryLvl1 ? (
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span
                            className="inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[0.65rem] font-medium"
                            style={{
                              background: "rgba(16,185,129,0.12)",
                              color: "#10b981",
                              border: "1px solid rgba(16,185,129,0.2)",
                            }}
                            title={item.categoryLvl1}
                          >
                            {item.categoryLvl1}
                          </span>
                          {item.categoryLvl2 && (
                            <span
                              className="block truncate text-[0.65rem]"
                              style={{ color: "var(--app-text-muted)" }}
                              title={item.categoryLvl2}
                            >
                              {item.categoryLvl2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[0.7rem]" style={{ color: "var(--app-text-muted)" }}>—</span>
                      )}
                    </td>

                    {/* Miktar */}
                    <td className="px-1.5 py-2 align-top whitespace-nowrap">
                      <span className="text-[0.7rem] tabular-nums" style={{ color: "var(--app-text-primary)" }}>
                        {item.quantity > 0 ? item.quantity : "—"}
                        {item.unitType ? (
                          <span className="ml-0.5" style={{ color: "var(--app-text-muted)" }}>{item.unitType}</span>
                        ) : null}
                      </span>
                    </td>

                    {/* Birim fiyat */}
                    <td className="px-1.5 py-2 align-top whitespace-nowrap text-right">
                      <span className="text-[0.7rem] tabular-nums" style={{ color: "var(--app-text-primary)" }}>
                        {fmt(item.unitPriceGross)}
                      </span>
                    </td>

                    {/* Satır toplam */}
                    <td className="px-1.5 py-2 align-top whitespace-nowrap text-right">
                      <span className="text-[0.7rem] font-medium tabular-nums" style={{ color: "var(--app-text-primary)" }}>
                        {fmt(item.lineTotalGross)}
                      </span>
                    </td>

                    {/* Güven */}
                    <td className="px-1.5 py-2 align-top min-w-0">
                      <div className="min-w-0 scale-90 origin-left">
                        <ConfidenceDot score={item.confidenceScore} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm" style={{ color: "var(--app-text-muted)" }}>
              {from}–{to} / {total.toLocaleString("tr-TR")}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={!hasPrev || isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-30"
                style={{ background: "var(--app-bg-elevated)", border: "1px solid var(--app-border)", color: "var(--app-text-primary)" }}
              >
                <ChevronLeft className="h-4 w-4" />
                Önceki
              </button>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={!hasNext || isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-30"
                style={{ background: "var(--app-bg-elevated)", border: "1px solid var(--app-border)", color: "var(--app-text-primary)" }}
              >
                Sonraki
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
