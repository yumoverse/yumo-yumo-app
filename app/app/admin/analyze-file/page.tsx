"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Loader2, FileText, ExternalLink, AlertCircle, Coins, PieChart, FileJson, ListChecks, Receipt } from "lucide-react";
import { useAppProfile } from "@/lib/app/profile-context";

interface HiddenCostLayers {
  platformEcosystem?: number;
  storeOperations?: number;
  supplyChain?: number;
  retailBrand?: number;
  stateLayer?: number;
}

interface AnalysisResult {
  receiptId: string;
  status: "ok" | "rejected" | "error";
  error?: string;
  extraction?: {
    merchantName?: string;
    totalPaid?: number;
    currency?: string;
    date?: string;
    time?: string;
    vat?: number;
    serviceCharge?: number;
  };
  pricing?: {
    totalPaid?: number;
    paidExTax?: number;
    vatAmount?: number;
    currency?: string;
    symbol?: string;
  };
  hiddenCost?: {
    totalHidden?: number;
    hiddenRate?: number;
    layers?: HiddenCostLayers;
    breakdown?: { items?: Array<{ label?: string; amount?: number; bucket?: string }> };
  };
  reward?: { raw?: number; final?: number; ryumo?: number; token?: string };
  qualityHonor?: {
    level?: string;
    honorDelta?: number;
    rewardPct?: number;
    reasons?: string[];
  };
  adminBreakdown?: {
    ocr?: { fullText?: string; lines?: Array<{ text?: string; lineNo?: number }> };
    extraction?: Record<string, unknown>;
    pipelineLog?: string;
  };
  pipelineLog?: string;
  saveFailed?: boolean;
  saveError?: string;
  /** Full API response for pipeline findings UI */
  fullResponse?: Record<string, unknown>;
}

type InputMode = "image" | "json";

export default function AdminAnalyzeFilePage() {
  const { profile } = useAppProfile();
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<InputMode>("image");
  const [file, setFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const userIsAdmin = !!profile?.isAdmin;
    setIsAdmin(userIsAdmin);
    if (!userIsAdmin && profile !== undefined) {
      setError("Bu sayfaya sadece admin erişebilir.");
    }
  }, [profile?.isAdmin, profile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setResult(null);
    setError(null);
  };

  const onJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setJsonFile(selected);
    setResult(null);
    setError(null);
  };

  const runAnalyzeWithBody = async (analyzeBody: Record<string, unknown>, options?: { skipSave?: boolean }) => {
    const skipSave = options?.skipSave === true;
    const analyzeRes = await fetch("/api/receipt/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analyzeBody),
    });
    const analyzeJson = await analyzeRes.json().catch(() => ({})) as Record<string, unknown>;
    const receiptId = (analyzeBody.receiptId as string) || "";
    if (!analyzeRes.ok) {
      setResult({
        receiptId,
        status: (analyzeJson.rejected ? "rejected" : "error") as "rejected" | "error",
        error: (analyzeJson.error as string) ?? analyzeRes.statusText,
        adminBreakdown: analyzeJson.adminBreakdown as AnalysisResult["adminBreakdown"],
        pipelineLog: analyzeJson.pipelineLog as string,
        extraction: (analyzeJson.adminBreakdown as any)?.extraction ?? analyzeJson.extraction,
        fullResponse: analyzeJson,
      });
      return;
    }
    let saveFailed = false;
    let saveError: string | undefined;
    if (!skipSave) {
      try {
        const saveRes = await fetch("/api/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(analyzeJson),
          credentials: "include",
        });
        if (!saveRes.ok) {
          const errData = await saveRes.json().catch(() => ({}));
          saveError = errData.error ?? saveRes.statusText ?? "Kayıt başarısız";
          saveFailed = true;
        }
      } catch (saveErr) {
        saveFailed = true;
        saveError = saveErr instanceof Error ? saveErr.message : "Fiş kaydetme hatası";
      }
    }
    const ext = analyzeJson.extraction as Record<string, unknown> | undefined;
    const dateVal = ext?.date && typeof ext.date === "object" && ext.date !== null && "value" in ext.date ? (ext.date as { value?: string }).value : undefined;
    const timeVal = ext?.time && typeof ext.time === "object" && ext.time !== null && "value" in ext.time ? (ext.time as { value?: string }).value : undefined;
    const totalVal = analyzeJson.pricing && typeof analyzeJson.pricing === "object" && "totalPaid" in analyzeJson.pricing ? (analyzeJson.pricing as { totalPaid?: number }).totalPaid : (ext?.total && typeof ext.total === "object" && ext.total !== null && "value" in ext.total ? (ext.total as { value?: number }).value : undefined);
    setResult({
      receiptId,
      status: "ok",
      saveFailed: saveFailed || undefined,
      saveError,
      extraction: {
        merchantName: (analyzeJson.merchant as any)?.name ?? (analyzeJson.adminBreakdown as any)?.extraction?.merchantName,
        totalPaid: totalVal,
        currency: (analyzeJson.pricing as any)?.currency ?? analyzeJson.currency,
        date: dateVal as string | undefined,
        time: timeVal as string | undefined,
        vat: (analyzeJson.pricing as any)?.vatAmount ?? (ext?.vat && typeof ext.vat === "object" && ext.vat !== null && "value" in ext.vat ? (ext.vat as { value?: number }).value : undefined),
        serviceCharge: (analyzeJson.pricing as any)?.serviceCharge ?? (ext?.serviceCharge && typeof ext.serviceCharge === "object" && ext.serviceCharge !== null && "value" in ext.serviceCharge ? (ext.serviceCharge as { value?: number }).value : undefined),
      },
      pricing: analyzeJson.pricing as AnalysisResult["pricing"],
      hiddenCost: analyzeJson.hiddenCost as AnalysisResult["hiddenCost"],
      reward: analyzeJson.reward as AnalysisResult["reward"],
      qualityHonor: analyzeJson.qualityHonor as AnalysisResult["qualityHonor"],
      adminBreakdown: analyzeJson.adminBreakdown as AnalysisResult["adminBreakdown"],
      pipelineLog: (analyzeJson.pipelineLog as string) ?? (analyzeJson.adminBreakdown as any)?.pipelineLog,
      fullResponse: analyzeJson,
    });
  };

  const handleAnalyze = async () => {
    if (!isAdmin) return;
    if (mode === "json") {
      if (!jsonFile) return;
      setProcessing(true);
      setResult(null);
      setError(null);
      try {
        const text = await jsonFile.text();
        const ocrJson = JSON.parse(text) as unknown;
        const receiptId = `json-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        await runAnalyzeWithBody(
          { receiptId, filename: jsonFile.name, ocrJson },
          { skipSave: true }
        );
      } catch (err) {
        setResult({
          receiptId: "",
          status: "error",
          error: err instanceof Error ? err.message : "JSON okunamadı veya analiz başarısız",
        });
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (!file) return;
    setProcessing(true);
    setResult(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/receipt/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
        setResult({ receiptId: "", status: "error", error: errData.error || uploadRes.statusText });
        setProcessing(false);
        return;
      }
      const uploadData = await uploadRes.json();
      const analyzeBody = {
        receiptId: uploadData.receiptId,
        hash: uploadData.hash,
        perceptualHash: uploadData.perceptualHash,
        filename: uploadData.filename ?? file.name,
        location: uploadData.location ?? null,
        marginViolation: uploadData.marginViolation ?? null,
        blobUrl: uploadData.blobUrl ?? null,
      };
      await runAnalyzeWithBody(analyzeBody);
    } catch (err) {
      setResult({
        receiptId: "",
        status: "error",
        error: err instanceof Error ? err.message : "Analiz başarısız",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!isAdmin && error) {
    return (
      <AppShell>
        <div className="container mx-auto p-6 max-w-2xl">
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto p-6 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Pipeline bulguları (Admin)
        </h1>
        <p className="text-muted-foreground mb-6">
          Görsel/PDF yükleyip Vision OCR ile analiz edebilir veya hazır OCR JSON dosyası yükleyip pipeline’ı çalıştırabilirsiniz. Bulgular (çıkarım, fiyat, gizli maliyet, OCR, log) bu sayfada gösterilir. Görsel/PDF ile de analiz edebilirsiniz.
        </p>

        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 border-b pb-4">
            <Button
              type="button"
              variant={mode === "image" ? "default" : "outline"}
              size="sm"
              onClick={() => { setMode("image"); setResult(null); setJsonFile(null); }}
              disabled={processing}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Görsel / PDF
            </Button>
            <Button
              type="button"
              variant={mode === "json" ? "default" : "outline"}
              size="sm"
              onClick={() => { setMode("json"); setResult(null); setFile(null); }}
              disabled={processing}
            >
              <FileJson className="h-4 w-4 mr-1.5" />
              OCR JSON
            </Button>
          </div>

          {mode === "image" && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer">
                <span className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  <Upload className="h-4 w-4" />
                  Görsel veya PDF seç
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  onChange={onFileChange}
                  disabled={processing}
                />
              </label>
              {file && (
                <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={file.name}>
                  {file.name}
                </span>
              )}
            </div>
          )}

          {mode === "json" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Desteklenen formatlar: <code className="text-xs bg-muted px-1 rounded">{`{ "lines": ["satır1", ...] }`}</code> veya <code className="text-xs bg-muted px-1 rounded">{`{ "fullText": "..." }`}</code> veya Vision API benzeri <code className="text-xs bg-muted px-1 rounded">fullTextAnnotation</code> / <code className="text-xs bg-muted px-1 rounded">textAnnotations</code>.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    <FileJson className="h-4 w-4" />
                    JSON dosyası seç
                  </span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    onChange={onJsonFileChange}
                    disabled={processing}
                  />
                </label>
                {jsonFile && (
                  <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={jsonFile.name}>
                    {jsonFile.name}
                  </span>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={processing || (mode === "image" ? !file : !jsonFile)}
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "json" ? "Analiz ediliyor…" : "Yükleniyor ve analiz ediliyor…"}
              </>
            ) : (
              "Analiz et"
            )}
          </Button>

          {result && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {result.status === "ok" && "Pipeline tamamlandı — bulgular aşağıda."}
                    {result.status === "rejected" && "Fiş reddedildi."}
                    {result.status === "error" && "Hata oluştu."}
                  </p>
                  {result.receiptId && (
                    <span className="text-xs text-muted-foreground font-mono" title={result.receiptId}>
                      {result.receiptId}
                    </span>
                  )}
                </div>
                {result.status === "ok" && !result.saveFailed && result.receiptId && !String(result.receiptId).startsWith("json-") && (
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <Link href={`/app/receipts/${result.receiptId}`}>
                      <ExternalLink className="h-4 w-4" />
                      Fiş detayına git
                    </Link>
                  </Button>
                )}
                {result.saveFailed && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Kayıt yapılmadı ({result.saveError})
                  </p>
                )}
                {result.error && <p className="text-sm text-destructive">{result.error}</p>}
              </div>

              <div className="rounded-lg border bg-card">
                <Tabs defaultValue="extraction" className="w-full">
                  <TabsList className="w-full grid grid-cols-3 h-auto p-1">
                    <TabsTrigger value="extraction" className="gap-1.5 text-xs sm:text-sm">
                      <Receipt className="h-4 w-4" />
                      Çıkarım
                    </TabsTrigger>
                    <TabsTrigger value="pricing" className="gap-1.5 text-xs sm:text-sm">
                      <PieChart className="h-4 w-4" />
                      Fiyat & Gizli maliyet
                    </TabsTrigger>
                    <TabsTrigger value="ocr" className="gap-1.5 text-xs sm:text-sm">
                      <ListChecks className="h-4 w-4" />
                      OCR & Log
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="extraction" className="p-4 pt-3 space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">Pipeline çıkarımı</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {result.extraction?.merchantName != null && (
                        <>
                          <dt className="text-muted-foreground">İşletme</dt>
                          <dd className="font-medium">{result.extraction.merchantName}</dd>
                        </>
                      )}
                      {result.extraction?.date != null && (
                        <>
                          <dt className="text-muted-foreground">Tarih</dt>
                          <dd>{result.extraction.date}</dd>
                        </>
                      )}
                      {result.extraction?.time != null && (
                        <>
                          <dt className="text-muted-foreground">Saat</dt>
                          <dd>{result.extraction.time}</dd>
                        </>
                      )}
                      {result.extraction?.totalPaid != null && (
                        <>
                          <dt className="text-muted-foreground">Toplam</dt>
                          <dd>{result.extraction.totalPaid.toLocaleString("tr-TR")} {result.extraction.currency ?? result.pricing?.symbol ?? "TRY"}</dd>
                        </>
                      )}
                      {result.extraction?.vat != null && result.extraction.vat > 0 && (
                        <>
                          <dt className="text-muted-foreground">KDV</dt>
                          <dd>{result.extraction.vat.toLocaleString("tr-TR")} {result.extraction.currency ?? "TRY"}</dd>
                        </>
                      )}
                      {result.extraction?.serviceCharge != null && result.extraction.serviceCharge > 0 && (
                        <>
                          <dt className="text-muted-foreground">Servis ücreti</dt>
                          <dd>{result.extraction.serviceCharge.toLocaleString("tr-TR")}</dd>
                        </>
                      )}
                      {Boolean(result.fullResponse?.merchant && typeof result.fullResponse.merchant === "object") && (
                        <>
                          <dt className="text-muted-foreground">Kategori</dt>
                          <dd>{String((result.fullResponse!.merchant as Record<string, unknown>).category ?? "—")}</dd>
                          <dt className="text-muted-foreground">Ülke</dt>
                          <dd>{String((result.fullResponse!.merchant as Record<string, unknown>).country ?? "—")}</dd>
                        </>
                      )}
                    </dl>
                  </TabsContent>
                  <TabsContent value="pricing" className="p-4 pt-3 space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">Fiyatlandırma & Gizli maliyet</h3>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      {result.pricing?.totalPaid != null && (
                        <div>
                          <dt className="text-muted-foreground text-xs">Toplam ödenen</dt>
                          <dd className="font-medium">{result.pricing.totalPaid.toLocaleString("tr-TR")} {result.pricing?.symbol ?? "TRY"}</dd>
                        </div>
                      )}
                      {result.pricing?.paidExTax != null && (
                        <div>
                          <dt className="text-muted-foreground text-xs">Vergi hariç</dt>
                          <dd>{result.pricing.paidExTax.toLocaleString("tr-TR")}</dd>
                        </div>
                      )}
                      {result.pricing?.vatAmount != null && result.pricing.vatAmount > 0 && (
                        <div>
                          <dt className="text-muted-foreground text-xs">KDV tutarı</dt>
                          <dd>{result.pricing.vatAmount.toLocaleString("tr-TR")}</dd>
                        </div>
                      )}
                      {result.hiddenCost?.totalHidden != null && (
                        <div>
                          <dt className="text-muted-foreground text-xs">Gizli maliyet</dt>
                          <dd>{Number(result.hiddenCost.totalHidden).toFixed(2)} {result.hiddenCost.hiddenRate != null && `(%${(Number(result.hiddenCost.hiddenRate) * 100).toFixed(1)})`}</dd>
                        </div>
                      )}
                      {result.reward?.final != null && (
                        <div>
                          <dt className="text-muted-foreground text-xs">Ödül (aYUMO)</dt>
                          <dd className="flex items-center gap-1"><Coins className="h-4 w-4 text-amber-500" /> {Number(result.reward.final).toFixed(2)} {result.reward?.token ?? "aYUMO"}</dd>
                        </div>
                      )}
                      {result.reward?.ryumo != null && (
                        <div>
                          <dt className="text-muted-foreground text-xs">Ödül (rYUMO)</dt>
                          <dd className="flex items-center gap-1"><Coins className="h-4 w-4 text-amber-500" /> {Number(result.reward.ryumo).toFixed(2)} rYUMO</dd>
                        </div>
                      )}
                      {result.qualityHonor != null && (
                        <div>
                          <dt className="text-muted-foreground text-xs">Kalite / Honor</dt>
                          <dd>{result.qualityHonor.level ?? "—"} {result.qualityHonor.honorDelta != null && `(${result.qualityHonor.honorDelta > 0 ? "+" : ""}${result.qualityHonor.honorDelta})`}</dd>
                        </div>
                      )}
                    </dl>
                    {result.hiddenCost?.layers && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Gizli maliyet katmanları</p>
                        <ul className="text-sm space-y-1">
                          {result.hiddenCost.layers.platformEcosystem != null && <li>Platform: {Number(result.hiddenCost.layers.platformEcosystem).toFixed(2)}</li>}
                          {result.hiddenCost.layers.storeOperations != null && <li>Mağaza: {Number(result.hiddenCost.layers.storeOperations).toFixed(2)}</li>}
                          {result.hiddenCost.layers.supplyChain != null && <li>Tedarik: {Number(result.hiddenCost.layers.supplyChain).toFixed(2)}</li>}
                          {result.hiddenCost.layers.retailBrand != null && <li>Marka: {Number(result.hiddenCost.layers.retailBrand).toFixed(2)}</li>}
                          {result.hiddenCost.layers.stateLayer != null && <li>Devlet: {Number(result.hiddenCost.layers.stateLayer).toFixed(2)}</li>}
                        </ul>
                      </div>
                    )}
                    {result.hiddenCost?.breakdown?.items && result.hiddenCost.breakdown.items.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Breakdown kalemleri</p>
                        <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                          {result.hiddenCost.breakdown.items.map((item, i) => (
                            <li key={i} className="flex justify-between gap-2">
                              <span>{item.label ?? "—"}</span>
                              <span>{item.amount != null ? Number(item.amount).toFixed(2) : ""} {item.bucket ? `(${item.bucket})` : ""}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="ocr" className="p-4 pt-3 space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">OCR satırları & Pipeline log</h3>
                    {result.adminBreakdown?.ocr?.lines && result.adminBreakdown.ocr.lines.length > 0 ? (
                      <div className="rounded bg-muted/30 p-3 max-h-48 overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {result.adminBreakdown.ocr.lines.map((line, i) => (
                            <span key={i} className="block">
                              {(line as { lineNo?: number }).lineNo ?? i + 1}. {(line as { text?: string }).text ?? String(line)}
                            </span>
                          ))}
                        </pre>
                      </div>
                    ) : result.fullResponse?.ocr && typeof result.fullResponse.ocr === "object" && Array.isArray((result.fullResponse.ocr as { lines?: unknown[] }).lines) ? (
                      <div className="rounded bg-muted/30 p-3 max-h-48 overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {((result.fullResponse.ocr as { lines: Array<{ lineNo?: number; text?: string }> }).lines).map((line, i) => (
                            <span key={i} className="block">{line.lineNo ?? i + 1}. {line.text ?? ""}</span>
                          ))}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">OCR satırları yok veya gösterilmiyor.</p>
                    )}
                    {result.pipelineLog && (
                      <details className="rounded bg-muted/20 p-3">
                        <summary className="cursor-pointer text-sm text-muted-foreground">Pipeline log</summary>
                        <pre className="mt-2 p-2 rounded bg-black/10 dark:bg-white/5 text-xs overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                          {result.pipelineLog}
                        </pre>
                      </details>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}

          {!result && (mode === "image" ? !file : !jsonFile) && (
            <p className="text-sm text-muted-foreground">
              {mode === "image"
                ? "Görsel veya PDF seçip \"Analiz et\" ile başlatın."
                : "OCR JSON dosyası seçip \"Analiz et\" ile başlatın."}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
