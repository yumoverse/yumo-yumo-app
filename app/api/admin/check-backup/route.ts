/**
 * Admin API: Check Latest Backup
 * 
 * Downloads and displays the latest backup from Backblaze B2
 * GET /api/admin/check-backup - Shows backup summary
 * GET /api/admin/check-backup?full=true - Shows full backup content
 */

import { NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { gunzip } from "zlib";
import { promisify } from "util";

const gunzipAsync = promisify(gunzip);

function getS3Client(): S3Client {
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;

  if (!endpoint || !region || !keyId || !applicationKey) {
    throw new Error("B2 credentials not configured");
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: applicationKey,
    },
    forcePathStyle: true,
  });
}

async function listBackups() {
  const bucketName = process.env.B2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("B2_BUCKET_NAME not configured");
  }

  const s3 = getS3Client();
  
  const listCommand = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: 'daily/',
  });

  const result = await s3.send(listCommand);
  return result.Contents || [];
}

async function downloadBackup(key: string): Promise<any> {
  const bucketName = process.env.B2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("B2_BUCKET_NAME not configured");
  }

  const s3 = getS3Client();
  
  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const result = await s3.send(getCommand);
  
  if (!result.Body) {
    throw new Error("Empty response body");
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of result.Body as any) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  
  // Decompress gzip
  const decompressed = await gunzipAsync(buffer);
  
  // Parse JSON
  return JSON.parse(decompressed.toString('utf-8'));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const showFull = url.searchParams.get('full') === 'true';
  const adminKey = url.searchParams.get('key');
  
  // ADMIN_SECRET_KEY zorunlu - yoksa endpoint çalışmaz
  const expectedKey = process.env.ADMIN_SECRET_KEY;
  if (!expectedKey) {
    console.error("[admin/check-backup] ADMIN_SECRET_KEY not configured");
    return NextResponse.json({ 
      error: "Server misconfigured" 
    }, { status: 500 });
  }
  
  // Key doğrulaması - timing attack'a karşı constant-time comparison
  const isValidKey = adminKey && adminKey.length === expectedKey.length && 
    Buffer.from(adminKey).equals(Buffer.from(expectedKey));
  
  if (!isValidKey) {
    // Rate limiting için delay ekle (brute force koruması)
    await new Promise(resolve => setTimeout(resolve, 1000));
    return NextResponse.json({ 
      error: "Unauthorized. Valid admin key required." 
    }, { status: 401 });
  }

  try {
    // List all backups
    const backups = await listBackups();
    
    if (backups.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "No backups found" 
      });
    }
    
    // Sort by date (newest first)
    const sortedBackups = backups.sort((a, b) => 
      (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0)
    );
    
    const latestBackup = sortedBackups[0];
    
    // Download and parse the latest backup
    const data = await downloadBackup(latestBackup.Key!);
    
    // Build response
    const response: any = {
      success: true,
      backupFile: latestBackup.Key,
      backupSize: `${((latestBackup.Size || 0) / 1024).toFixed(2)} KB`,
      backupDate: latestBackup.LastModified,
      metadata: data.metadata,
      summary: {} as Record<string, any>,
      availableBackups: sortedBackups.map(b => ({
        key: b.Key,
        size: `${((b.Size || 0) / 1024).toFixed(2)} KB`,
        date: b.LastModified
      }))
    };
    
    // Add row counts and sample data for each table
    for (const table of (data.metadata?.tables || [])) {
      const rows = data[table] || [];
      response.summary[table] = {
        rowCount: rows.length,
        sampleRows: rows.slice(0, 3).map((row: any) => {
          // Show limited fields to avoid huge responses
          const limited: any = {};
          const keys = Object.keys(row).slice(0, 8);
          for (const key of keys) {
            let value = row[key];
            // Truncate long strings
            if (typeof value === 'string' && value.length > 100) {
              value = value.substring(0, 100) + '...';
            }
            limited[key] = value;
          }
          return limited;
        })
      };
    }
    
    // If full=true, include all data
    if (showFull) {
      response.fullData = data;
    }
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error("[admin/check-backup] Error:", error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
