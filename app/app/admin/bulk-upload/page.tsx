"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Upload, Loader2, Download, FileText, FileSearch } from "lucide-react";
import { useAppLocale } from "@/lib/i18n/app-context";
import { useAppProfile } from "@/lib/app/profile-context";
const MAX_FILES = 50;

interface ProcessedReceipt {
  fileName: string;
  logFileName: string;
  content: string;
  receiptId: string;
  error?: string;
}

function buildLogContent(ocrRawText: string | undefined, ocrLines: string[] | undefined, pipelineLog: string | undefined): string {
  const sections: string[] = [];
  sections.push("=== OCR (Ham Metin) ===");
  sections.push(ocrRawText ?? "(OCR metni yok)");
  sections.push("");
  sections.push("=== OCR Satırlar ===");
  sections.push(Array.isArray(ocrLines) && ocrLines.length > 0 ? ocrLines.join("\n") : "(yok)");
  sections.push("");
  sections.push("=== PIPELINE LOG ===");
  sections.push(pipelineLog ?? "(pipeline log yok)");
  return sections.join("\n");
}

export default function AdminBulkUploadPage() {
  const { t } = useAppLocale();
  const { profile } = useAppProfile();
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ProcessedReceipt[]>([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const userIsAdmin = !!profile?.isAdmin;
    setIsAdmin(userIsAdmin);
    if (!userIsAdmin && profile !== undefined) {
      setError("Bu sayfaya erişim yetkiniz yok.");
    }
  }, [profile?.isAdmin, profile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;
    const list = Array.from(selected).slice(0, MAX_FILES);
    setFiles(list);
    setResults([]);
    setError(null);
  };

  const processOne = async (file: File): Promise<ProcessedReceipt | null> => {
    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch("/api/receipt/upload", {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) {
      const errData = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
      return {
        fileName: file.name,
        logFileName: file.name.replace(/\.[^.]+$/i, '.log'),
        content: buildLogContent(
          undefined,
          undefined,
          `[UPLOAD ERROR] ${errData.error || uploadRes.statusText}\n\n${JSON.stringify(errData, null, 2)}`
        ),
        receiptId: "",
        error: errData.error || String(uploadRes.status),
      };
    }

    const uploadData = await uploadRes.json();
    const receiptId = uploadData.receiptId;

    const analyzeBody = {
      receiptId,
      hash: uploadData.hash,
      perceptualHash: uploadData.perceptualHash,
      filename: uploadData.filename ?? file.name,
      location: uploadData.location ?? null,
      marginViolation: uploadData.marginViolation ?? null,
      blobUrl: uploadData.blobUrl ?? null,
    };

    const analyzeRes = await fetch("/api/receipt/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analyzeBody),
    });

    const analyzeJson = await analyzeRes.json().catch(() => ({}));

    if (!analyzeRes.ok) {
      const adminOcr = analyzeJson.adminBreakdown?.ocr;
      const ocrText = adminOcr?.fullText ?? adminOcr?.textPreview ?? "";
      const ocrLines = adminOcr?.lines ?? [];
      const pipelineLog = analyzeJson.pipelineLog ?? `[ANALYZE ERROR] ${analyzeJson.error ?? analyzeRes.statusText}\n\n${JSON.stringify(analyzeJson, null, 2)}`;
      const content = buildLogContent(ocrText, ocrLines, pipelineLog);
      const logFileName = file.name.replace(/\.[^.]+$/i, '.log');
      return {
        fileName: file.name,
        logFileName,
        content,
        receiptId,
        error: analyzeJson.error ?? String(analyzeRes.status),
      };
    }

    const logFileName = file.name.replace(/\.[^.]+$/i, '.log');
    const content = buildLogContent(
      analyzeJson.ocr?.rawText,
      analyzeJson.ocr?.lines,
      analyzeJson.pipelineLog
    );
    return {
      fileName: file.name,
      logFileName,
      content,
      receiptId,
    };
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setProgress({ current: 0, total: files.length });
    const processed: ProcessedReceipt[] = [];

    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length });
      const result = await processOne(files[i]);
      if (result) processed.push(result);
    }

    setResults(processed);
    setProcessing(false);
  };

  const handleDownloadZip = async () => {
    if (results.length === 0) return;
    setDownloading(true);
    try {
      const JSZip = (await import("jszip")).default;
      const { saveAs } = await import("file-saver");
      const zip = new JSZip();
      const seen = new Set<string>();
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        let name = r.logFileName;
        if (seen.has(name)) {
          name = name.replace(/\.log$/, `-${i}.log`);
        }
        seen.add(name);
        zip.file(name, r.content, { createFolders: false });
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const timestamp = new Date().toISOString().split("T")[0];
      saveAs(zipBlob, `fis_ocr_log_${timestamp}.zip`);
    } catch (e) {
      console.error(e);
      alert(t("errors.admin.zipCreateFailed"));
    } finally {
      setDownloading(false);
    }
  };

  if (!isAdmin && error) {
    return (
      <AppShell>
        <div className="container mx-auto p-6 max-w-4xl">
          <p className="text-destructive">{error}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto p-6 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Toplu Fiş Yükle (Admin)
        </h1>
        <p className="text-muted-foreground mb-4">
          Birden fazla fiş seçin. Her biri yüklenecek ve analiz edilecek; OCR + pipeline log tek dosyada toplanıp
          log dosyası adı <strong>yüklenen görsel adıyla aynı</strong> (uzantı .log) ZIP ile indirilebilir.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          <Link href="/app/admin/analyze-file" className="inline-flex items-center gap-1.5 text-primary hover:underline">
            <FileSearch className="h-4 w-4" />
            Masaüstünden tek dosya seçerek analiz et
          </Link>
        </p>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer">
              <span className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Upload className="h-4 w-4" />
                Dosya Seç (en fazla {MAX_FILES})
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="sr-only"
                onChange={onFileChange}
                disabled={processing}
              />
            </label>
            {files.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {files.length} dosya seçildi
              </span>
            )}
          </div>

          <Button
            onClick={handleProcess}
            disabled={files.length === 0 || processing}
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                İşleniyor {progress.current}/{progress.total}
              </>
            ) : (
              "Yükle ve analiz et"
            )}
          </Button>

          {results.length > 0 && (
            <>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="font-medium text-gray-900">
                  {results.length} fiş işlendi. OCR + log dosyalarını ZIP olarak indirebilirsiniz.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Dosya adları: görsel adıyla aynı (uzantı .log)
                </p>
              </div>
              <ul className="max-h-96 overflow-y-auto border rounded-lg divide-y">
                {results.map((r, i) => (
                  <li key={i} className="p-3 hover:bg-muted/30">
                    <p className="text-sm font-mono truncate text-gray-900">{r.logFileName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.fileName}
                      {r.error && <span className="text-destructive ml-2">({r.error})</span>}
                    </p>
                  </li>
                ))}
              </ul>
              <Button
                onClick={handleDownloadZip}
                disabled={downloading || results.length === 0}
                variant="default"
                className="w-full sm:w-auto"
              >
                {downloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ZIP indiriliyor...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    OCR + Log ZIP İndir
                  </>
                )}
              </Button>
            </>
          )}

          {!processing && files.length === 0 && results.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Dosya seçip &quot;Yükle ve analiz et&quot; ile toplu fiş işlemeyi başlatın.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
