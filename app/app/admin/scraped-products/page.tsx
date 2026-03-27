"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Package, Search } from "lucide-react";
import { useAppProfile } from "@/lib/app/profile-context";

const PAGE_SIZE = 100;

interface ScrapedItem {
  id: number;
  merchantCanonicalName: string;
  rawName: string;
  canonicalName: string | null;
  priceTl: number | null;
  unit: string | null;
  scrapedAt: string;
}

export default function AdminScrapedProductsPage() {
  const router = useRouter();
  const { profile } = useAppProfile();
  const [items, setItems] = useState<ScrapedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [merchants, setMerchants] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setIsAdmin(!!profile?.isAdmin);
    if (!profile?.isAdmin) {
      setError("Bu sayfaya sadece admin erişebilir.");
      setIsLoading(false);
      return;
    }
    loadMerchants();
  }, [profile?.isAdmin]);

  const loadMerchants = async () => {
    try {
      const res = await fetch("/api/admin/scraped-products/merchants");
      if (!res.ok) return;
      const data = await res.json();
      setMerchants(data.merchants ?? []);
    } catch {
      setMerchants([]);
    }
  };

  const loadItems = async () => {
    if (!profile?.isAdmin) return;
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (merchantFilter) params.set("merchant", merchantFilter);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      const res = await fetch(`/api/admin/scraped-products?${params}`);
      if (!res.ok) {
        if (res.status === 403) throw new Error("Yetkisiz.");
        throw new Error("Liste yüklenemedi.");
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Liste yüklenemedi.");
      setItems([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadItems();
  }, [isAdmin, q, merchantFilter, offset]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQ(searchInput.trim());
    setOffset(0);
  };

  if (!isAdmin) {
    return (
      <AppShell>
        <ErrorState
          message="Bu sayfaya sadece admin erişebilir."
          onRetry={() => router.push("/app/dashboard")}
        />
      </AppShell>
    );
  }

  if (error && !isLoading) {
    return (
      <AppShell>
        <ErrorState message={error} onRetry={loadItems} />
      </AppShell>
    );
  }

  const from = offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Kazınan Ürünler</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scraper ile toplanan ürünler (Migros, Starbucks vb.). Sadece admin görür.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ürün adı veya canonical ara..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="secondary" size="default">
              Ara
            </Button>
          </form>
          <select
            value={merchantFilter}
            onChange={(e) => {
              setMerchantFilter(e.target.value);
              setOffset(0);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm max-w-[200px]"
          >
            <option value="">Tüm marketler</option>
            {merchants.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={loadItems} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yenile"}
          </Button>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Toplam {total} kayıt. {total > 0 && `${from}–${to} arası gösteriliyor.`}
          </span>
          {total > PAGE_SIZE && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev || isLoading}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                Önceki
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext || isLoading}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Sonraki
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <DataTable
            columns={[]}
            data={[]}
            isLoading
            emptyMessage="Yükleniyor..."
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Kayıt yok"
            description="Scraper henüz veri toplamamış veya filtreye uyan kayıt yok."
          />
        ) : (
          <DataTable<ScrapedItem>
            columns={[
              {
                key: "merchantCanonicalName",
                header: "Market",
                render: (r) => <span className="text-sm font-medium">{r.merchantCanonicalName}</span>,
              },
              {
                key: "rawName",
                header: "Ham ürün adı",
                render: (r) => <span className="text-sm truncate max-w-[280px] block" title={r.rawName}>{r.rawName}</span>,
              },
              {
                key: "canonicalName",
                header: "Canonical",
                render: (r) => (
                  <span className="text-sm text-muted-foreground truncate max-w-[180px] block">
                    {r.canonicalName ?? "—"}
                  </span>
                ),
              },
              {
                key: "priceTl",
                header: "Fiyat (TL)",
                render: (r) => (
                  <span className="text-sm tabular-nums">
                    {r.priceTl != null ? Number(r.priceTl).toLocaleString("tr-TR") : "—"}
                  </span>
                ),
              },
              {
                key: "unit",
                header: "Birim",
                render: (r) => <span className="text-sm text-muted-foreground">{r.unit ?? "—"}</span>,
              },
              {
                key: "scrapedAt",
                header: "Tarih",
                render: (r) => (
                  <span className="text-sm text-muted-foreground">
                    {r.scrapedAt ? new Date(r.scrapedAt).toLocaleString("tr-TR") : "—"}
                  </span>
                ),
              },
            ]}
            data={items}
            emptyMessage="Kayıt yok"
          />
        )}
      </div>
    </AppShell>
  );
}
