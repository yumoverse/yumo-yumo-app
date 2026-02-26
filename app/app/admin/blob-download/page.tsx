'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppLocale } from '@/lib/i18n/app-context';

interface BlobFile {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
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

export default function BlobDownloadPage() {
  const { t } = useAppLocale();
  const [blobs, setBlobs] = useState<BlobFile[]>([]);
  const [filteredBlobs, setFilteredBlobs] = useState<BlobFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('48'); // Default 48 saat
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFetchBlobs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/blobs/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: parseInt(timeRange) }),
      });

      if (!response.ok) {
        throw new Error('Blob listesi alınamadı');
      }

      const data = await response.json();
      setBlobs(data.data || []);
      setFilteredBlobs(data.data || []);
      setSearchQuery(''); // Arama kutusunu temizle
    } catch (error) {
      console.error('Hata:', error);
      alert(t('errors.admin.filesLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredBlobs(blobs);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = blobs.filter((blob) =>
      blob.pathname.toLowerCase().includes(lowerQuery)
    );
    setFilteredBlobs(filtered);
  };

  const handleDownloadAll = async () => {
    if (filteredBlobs.length === 0) {
      alert(t('errors.admin.noFilesToDownload'));
      return;
    }

    setDownloading(true);
    setProgress({ current: 0, total: filteredBlobs.length });

    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');

      const zip = new JSZip();

      for (let i = 0; i < filteredBlobs.length; i++) {
        const blob = filteredBlobs[i];
        setProgress({ current: i + 1, total: filteredBlobs.length });

        try {
          const response = await fetch(blob.url);
          const arrayBuffer = await response.arrayBuffer();
          const filename = blob.pathname.split('/').pop() || `file_${i}.jpg`;
          zip.file(filename, arrayBuffer);
        } catch (error) {
          console.error(`Dosya indirilemedi: ${blob.pathname}`, error);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      saveAs(zipBlob, `makbuzlar_${timestamp}.zip`);
    } catch (error) {
      console.error('ZIP oluşturulamadı:', error);
      alert(t('errors.admin.zipFileCreateFailed'));
    } finally {
      setDownloading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const totalSize = filteredBlobs.reduce((sum, blob) => sum + blob.size, 0);
  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Makbuz İndir (Admin)</h1>

      <div className="space-y-4">
        {/* Zaman Aralığı Seçimi */}
        <div className="flex gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Zaman aralığı seç" />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleFetchBlobs}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Yükleniyor...
              </>
            ) : (
              'Dosyaları Listele'
            )}
          </Button>
        </div>

        {blobs.length > 0 && (
          <>
            <Input
              type="text"
              placeholder="Dosya adında ara..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full"
            />

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-900 font-medium">
                Toplam {filteredBlobs.length} dosya ({totalSizeMB} MB)
              </p>
              {searchQuery && (
                <p className="text-sm text-gray-600 mt-1">
                  "{searchQuery}" için {filteredBlobs.length} sonuç bulundu
                </p>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              <ul className="divide-y divide-gray-200">
                {filteredBlobs.map((blob, index) => (
                  <li key={index} className="p-3 hover:bg-gray-50">
                    <p className="text-sm font-mono text-gray-900 truncate">
                      {blob.pathname}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {(blob.size / 1024).toFixed(2)} KB •{' '}
                      {new Date(blob.uploadedAt).toLocaleString('tr-TR')}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              onClick={handleDownloadAll}
              disabled={downloading || filteredBlobs.length === 0}
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
      </div>
    </div>
  );
}