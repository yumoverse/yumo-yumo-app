'use client';

import { useState } from 'react';
import { Download, FileType, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppLocale } from '@/lib/i18n/app-context';

const MAX_FILES_PER_DOWNLOAD = 1000;

interface ReceiptOcrItem {
  receiptId: string;
  blobFilename: string | null;
  ocrRawText: string;
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

function ocrFilename(item: ReceiptOcrItem): string {
  if (item.blobFilename) {
    return item.blobFilename.replace(/\.[^.]+$/i, '.txt');
  }
  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
  const name = sanitize(item.merchantName || 'receipt');
  return `${name}-${item.receiptId}.txt`;
}

export default function OcrDownloadPage() {
  const { t } = useAppLocale();
  const [items, setItems] = useState<ReceiptOcrItem[]>([]);
  const [timeRange, setTimeRange] = useState('48');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFetchOcr = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/ocr-download?hours=${parseInt(timeRange)}&limit=${MAX_FILES_PER_DOWNLOAD}`
      );
      if (!res.ok) throw new Error('RAW OCR listesi alınamadı');
      const data = await res.json();
      setItems(data.receipts || []);
    } catch (e) {
      console.error(e);
      alert(t('errors.admin.filesLoadFailed') || 'RAW OCR listesi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (items.length === 0) {
      alert('İndirilecek OCR dosyası yok.');
      return;
    }
    if (items.length > MAX_FILES_PER_DOWNLOAD) {
      alert(`Tek seferde en fazla ${MAX_FILES_PER_DOWNLOAD} dosya indirilebilir.`);
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
        const name = ocrFilename(item);
        zip.file(name, item.ocrRawText || '', { createFolders: false });
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      saveAs(zipBlob, `raw_ocr_${timestamp}.zip`);
    } catch (e) {
      console.error(e);
      alert(t('errors.admin.zipFileCreateFailed') || 'ZIP oluşturulamadı.');
    } finally {
      setDownloading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 flex items-center gap-2">
        <FileType className="h-8 w-8" />
        RAW OCR İndir (Admin)
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
            onClick={handleFetchOcr}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Yükleniyor...
              </>
            ) : (
              'Fişleri Listele'
            )}
          </Button>
        </div>

        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Tek seferde en fazla <strong>{MAX_FILES_PER_DOWNLOAD}</strong> adet RAW OCR dosyası indirilebilir.
          Zaman aralığında daha fazla fiş varsa önce listeyi alıp sonra indirin; liste bu limite göre kırpılır.
        </p>

        {items.length > 0 && (
          <>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-900 font-medium">
                Toplam {items.length} fişin RAW OCR metni indirilebilir
                {items.length >= MAX_FILES_PER_DOWNLOAD && (
                  <span className="text-amber-700"> (maksimum limite ulaşıldı, aralıkta daha fazla fiş olabilir)</span>
                )}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Dosya adları: blob ile aynı isim (uzantı .txt)
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              <ul className="divide-y divide-gray-200">
                {items.slice(0, 15).map((item) => (
                  <li key={item.receiptId} className="p-3 hover:bg-gray-50">
                    <p className="text-sm font-mono text-gray-900 truncate">
                      {ocrFilename(item)}
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
                  ... ve {items.length - 15} dosya daha
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
                  Hepsini ZIP İndir ({items.length} dosya)
                </>
              )}
            </Button>
          </>
        )}

        {!loading && items.length === 0 && (
          <p className="text-gray-500 text-sm">
            Zaman aralığı seçip &quot;Fişleri Listele&quot; ile RAW OCR listesini yükleyin.
          </p>
        )}
      </div>
    </div>
  );
}
