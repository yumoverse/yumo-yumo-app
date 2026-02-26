/**
 * Cron Job: Daily Database Backup
 * 
 * This endpoint is called by Vercel Cron to create daily backups of critical database tables.
 * Backups are compressed and uploaded to Backblaze B2.
 * 
 * Schedule: Every day at 03:00 UTC (configurable in vercel.json)
 */

import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { gzip } from "zlib";
import { promisify } from "util";

const gzipAsync = promisify(gzip);

// Kritik tablolar (backup edilecek)
const CRITICAL_TABLES = [
  // 'receipts', // Receipts tablosu artık özel olarak işlenecek
  'users',
  'user_profiles',
  'economic_indices',
  'merchant_tiers',
  'city_tiers'
];

async function exportTableToJSON(sql: any, tableName: string, offset: number = 0, limit: number | null = null): Promise<any[]> {
  // SQL injection'dan korunmak için table name'i SIKI validate et
  // Sadece whitelist'teki tablolar kabul edilir
  if (!CRITICAL_TABLES.includes(tableName) && tableName !== 'receipts') {
    throw new Error(`Invalid table name: ${tableName}`);
  }

  console.log(`[backup] Exporting table: ${tableName}`);
  
  try {
    let result: any[];
    
    switch (tableName) {
      case 'receipts':
        // Parçalı yedekleme için OFFSET ve LIMIT kullan (parametrized; unsafe string yok)
        result = limit !== null
          ? await sql`SELECT * FROM receipts OFFSET ${offset} LIMIT ${limit}`
          : await sql`SELECT * FROM receipts`;
        break;
      case 'users':
        result = await sql`SELECT * FROM users`;
        break;
      case 'user_profiles':
        result = await sql`SELECT * FROM user_profiles`;
        break;
      case 'economic_indices':
        result = await sql`SELECT * FROM economic_indices`;
        break;
      case 'merchant_tiers':
        result = await sql`SELECT * FROM merchant_tiers`;
        break;
      case 'city_tiers':
        result = await sql`SELECT * FROM city_tiers`;
        break;
      default:
        // Bu noktaya ulaşılmamalı (whitelist kontrolü var)
        throw new Error(`Unknown table: ${tableName}`);
    }
    
    console.log(`[backup] Exported ${result.length} rows from ${tableName}`);
    return result;
  } catch (error: any) {
    console.error(`[backup] Failed to export ${tableName}:`, error.message);
    return [];
  }
}

async function createBackup(): Promise<Buffer> {
  const backup: Record<string, any> = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: "1.0",
      tables: CRITICAL_TABLES
    }
  };

  // Neon serverless driver SADECE pooler endpoint ile çalışır!
  const { neon } = await import("@neondatabase/serverless");
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    throw new Error("DATABASE_URL not available");
  }
  const sql = neon(dbUrl as string);

  // Diğer tabloları export et
  for (const tableName of CRITICAL_TABLES) {
    try {
      backup[tableName] = await exportTableToJSON(sql, tableName);
      console.log(`[backup] Exported ${tableName}: ${backup[tableName].length} rows`);
    } catch (error: any) {
      console.error(`[backup] Failed to export ${tableName}:`, error.message);
      backup[tableName] = []; // Hata durumunda boş array
    }
  }

  // Receipts tablosu için özel parçalı yedekleme
  const CHUNK_SIZE = 50000; // Her seferinde 50.000 satır çek
  let offset = 0;
  let totalReceiptsExported = 0;
  let hasMore = true;
  backup.receipts = []; // Receipts verilerini burada toplayacağız

  console.log(`[backup] Starting chunked export for receipts with CHUNK_SIZE: ${CHUNK_SIZE}`);

  while (hasMore) {
    try {
      const chunk = await exportTableToJSON(sql, 'receipts', offset, CHUNK_SIZE);
      backup.receipts.push(...chunk);
      totalReceiptsExported += chunk.length;
      console.log(`[backup] Exported chunk of receipts: ${chunk.length} rows (total: ${totalReceiptsExported})`);

        if (chunk.length < CHUNK_SIZE) {
        hasMore = false; // Daha fazla veri yok
      } else {
        offset += CHUNK_SIZE;
      }
    } catch (error: any) {
      console.error(`[backup] Failed to export receipts chunk at offset ${offset}:`, error.message);
      hasMore = false; // Hata durumunda döngüyü sonlandır
    }
  }
  console.log(`[backup] Completed chunked export for receipts: ${totalReceiptsExported} total rows.`);

  // Yedeklenen tüm tabloları metadata'ya ekle
  backup.metadata.tables = Object.keys(backup).filter(key => key !== 'metadata');

  // JSON'a çevir ve gzip ile sıkıştır
  const jsonString = JSON.stringify(backup, null, 2);
  const compressed = await gzipAsync(Buffer.from(jsonString, 'utf-8'));
  
  return compressed;
}

function getS3Client(): S3Client {
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;

  if (!endpoint || !region || !keyId || !applicationKey) {
    throw new Error("B2 credentials not configured");
  }

  return new S3Client({
    endpoint: endpoint,
    region: region,
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: applicationKey,
    },
    forcePathStyle: true, // B2 requires path-style URLs
  });
}

async function uploadToB2(data: Buffer, filename: string): Promise<string> {
  const bucketName = process.env.B2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("B2_BUCKET_NAME not configured");
  }

  const s3 = getS3Client();
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: `daily/${filename}`,
    Body: data,
    ContentType: 'application/gzip',
    ContentEncoding: 'gzip',
  });

  const result = await s3.send(command);
  return result.ETag || filename;
}

async function cleanupOldBackups(): Promise<number> {
  const bucketName = process.env.B2_BUCKET_NAME;
  if (!bucketName) {
    return 0;
  }

  const s3 = getS3Client();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    // List all files in daily/ folder
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'daily/',
    });

    const listResult = await s3.send(listCommand);
    if (!listResult.Contents) {
      return 0;
    }

    let deletedCount = 0;
    for (const object of listResult.Contents) {
      if (object.Key && object.LastModified && object.LastModified < thirtyDaysAgo) {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: object.Key,
        });
        await s3.send(deleteCommand);
        deletedCount++;
        console.log(`[backup] Deleted old backup: ${object.Key}`);
      }
    }

    return deletedCount;
  } catch (error: any) {
    console.error("[backup] Failed to cleanup old backups:", error.message);
    return 0;
  }
}

function checkCronAuth(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: Request) {
  console.log("=".repeat(80));
  console.log("[cron/daily-backup] 🕐 Daily backup started");
  console.log("=".repeat(80));

  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Debug: Check DATABASE_URL
  console.log("[backup] DATABASE_URL exists:", !!process.env.DATABASE_URL);
  console.log("[backup] DATABASE_URL host:", process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).host : "N/A");

  try {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
    const filename = `yumo_backup_${dateStr}.json.gz`;

    // Backup oluştur
    console.log("[backup] Creating backup...");
    const backupData = await createBackup();
    console.log(`[backup] ✅ Backup created: ${(backupData.length / 1024 / 1024).toFixed(2)} MB`);

    // B2'ye upload et
    console.log("[backup] Uploading to Backblaze B2...");
    const fileId = await uploadToB2(backupData, filename);
    console.log(`[backup] ✅ Uploaded to B2: ${filename}`);

    // Eski backup'ları temizle
    console.log("[backup] Cleaning up old backups (30+ days)...");
    const deletedCount = await cleanupOldBackups();
    if (deletedCount > 0) {
      console.log(`[backup] ✅ Deleted ${deletedCount} old backup(s)`);
    }

    console.log("=".repeat(80));
    console.log("[cron/daily-backup] ✅ Daily backup completed");
    console.log("=".repeat(80));

    return NextResponse.json({
      success: true,
      filename,
      size: backupData.length,
      deletedOldBackups: deletedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[cron/daily-backup] ❌ Error:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create backup",
        details: error?.message ?? String(error)
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(req: Request) {
  return GET(req);
}
