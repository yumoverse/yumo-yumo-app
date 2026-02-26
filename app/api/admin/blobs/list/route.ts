import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { getSessionUsername } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/admin-users";

export async function POST(req: Request) {
  try {
    // Admin kontrolü
    const username = await getSessionUsername();
    if (!username || !isAdminUser(username)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Zaman aralığını body'den al
    const body = await req.json();
    const hours = body.hours || 48; // Default 48 saat

    console.log(`[api/admin/blobs/list] Hours: ${hours}, Cutoff: ${new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()}`);

    const cutoffMs = hours * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - cutoffMs);

    const { blobs } = await list();
    const recentBlobs = blobs.filter(blob => 
      new Date(blob.uploadedAt) > cutoffDate
    );

    const mappedData = recentBlobs.map(blob => ({
      url: blob.downloadUrl,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: mappedData,
      count: recentBlobs.length,
    });
  } catch (error) {
    console.error('Blob listesi alınırken hata:', error);
    return NextResponse.json(
      { success: false, error: 'Dosyalar alınamadı' },
      { status: 500 }
    );
  }
}