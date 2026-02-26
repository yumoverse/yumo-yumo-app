'use client';

import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppLocale } from '@/lib/i18n/app-context';

interface ReceiptLogItem {
  receiptId: string;
  blobFilename: string | null;
  pipelineLog: string;
  createdAt: string;
  merchantName: string | null;
}

const TIME_OPTIONS = [
  { value: '1', label: 'Son 1 Saat' },
  { value: '6', label: 'Son 6 Saat' },
  { value: '24', label: 'Son 24 Saat' },
  { value: '48', label: 'Son 48 Saat' },
  { value: '168', label: 'Son 1 Hafta (168 saat)' },
  { value: '720', label: 'Son 1 Ay (30 gün)' },
  { value: '2160', label: 'Son 3 Ay (90 gün)' },
];

function logFilename(item: ReceiptLogItem): string {
  return `${item.receiptId}.log`;
}

export default function LogDownloadPage() {
  const { t } = useAppLocale();
  const [items, setItems] = useState<ReceiptLogItem[]>([]);
  const [timeRange, setTimeRange] = useState('48');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/receipt-logs?hours=${parseInt(timeRange)}&limit=500`
      );
      if (!res.ok) throw new Error('Log listesi alınamadı');
      const data = await res.json();
      setItems(data.receipts || []);
    } catch (e) {
      console.error(e);
      alert(t('errors.admin.logsLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (items.length === 0) {
      alert(t('errors.admin.noLogsToDownload'));
      return;
    }

    setDownloading(true);
    setProgress({ current: 0, total: items.length });

    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');

      const zip = new JSZip();

      for (let i = 0; i < items.length; i++) {
        setProgress({ current: i + 1, total: items.length });
        const item = items[i];
        const name = logFilename(item);
        zip.file(name, item.pipelineLog, { createFolders: false });
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      saveAs(zipBlob, `fiş_logları_${timestamp}.zip`);
    } catch (e) {
      console.error(e);
      alert(t('errors.admin.zipCreateFailed'));
    } finally {
      setDownloading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 flex items-center gap-2">
        <FileText className="h-8 w-8" />
        Toplu Log İndir (Admin)
      </h1>

      <div className="space-y-4">
        <div className="flex gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Zaman aralığı seç" />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleFetchLogs}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Yükleniyor...
              </>
            ) : (
              'Logları Listele'
            )}
          </Button>
        </div>

        {items.length > 0 && (
          <>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-900 font-medium">
                Toplam {items.length} fişin logu indirilebilir
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Dosya adları: görsel adıyla aynı (uzantı .log)
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              <ul className="divide-y divide-gray-200">
                {items.slice(0, 15).map((item) => (
                  <li key={item.receiptId} className="p-3 hover:bg-gray-50">
                    <p className="text-sm font-mono text-gray-900 truncate">
                      {logFilename(item)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {item.merchantName || item.receiptId} •{' '}
                      {new Date(item.createdAt).toLocaleString('tr-TR')}
                    </p>
                  </li>
                ))}
              </ul>
              {items.length > 15 && (
                <p className="text-sm text-gray-600 p-3 bg-gray-50 text-center">
                  ... ve {items.length - 15} log daha
                </p>
              )}
            </div>

            <Button
              onClick={handleDownloadAll}
              disabled={downloading || items.length === 0}
              className="w-full"
              variant="default"
            >
              {downloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  İndiriliyor... ({progress.current}/{progress.total})
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Hepsini ZIP İndir
                </>
              )}
            </Button>
          </>
        )}

        {!loading && items.length === 0 && (
          <p className="text-gray-500 text-sm">
            Zaman aralığı seçip &quot;Logları Listele&quot; ile fiş loglarını
            yükleyin.
          </p>
        )}
      </div>
    </div>
  );
}
