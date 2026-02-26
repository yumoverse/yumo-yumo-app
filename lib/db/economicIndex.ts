/**
 * Economic index database functions
 * 
 * Provides functions to lookup and manage economic indices from database
 */

import { db } from "./client";
import { CountryCode } from "@/lib/mining/types";
import { EconomicIndexType } from "@/lib/mining/economicIndex";

export interface EconomicIndexRow {
  country: string;
  index_type: string;
  year_month: string;
  value: number;
  source?: string;
}

/**
 * Get economic index from database
 * Falls back to latest value before requested month if exact match not found
 * 
 * @param country - Country code (e.g., "TR", "US")
 * @param indexType - Type of index (CPI, FUEL, LABOR, RENT, DIGITAL)
 * @param yearMonth - Time period in "YYYY-MM" format
 * @returns Normalized index value (1.0 = reference baseline) or null if not found
 */
/**
 * Get economic index from DB with optional series (for TÜFE/ÜFE category-level).
 * @param series - Use '' for aggregate (legacy), or e.g. '01', 'GENEL', 'ARM' for category series
 */
export async function getEconomicIndexFromDB(
  country: CountryCode,
  indexType: EconomicIndexType,
  yearMonth: string,
  series: string = ""
): Promise<number | null> {
  try {
    console.log(`[getEconomicIndexFromDB] 🔍 Querying DB: ${country} ${indexType} ${series || '(aggregate)'} ${yearMonth}`);
    
    // Use sql template literal directly for better reliability
    const { getSql } = await import('@/lib/db/client');
    const sql = getSql();
    if (!sql) {
      console.error(`[getEconomicIndexFromDB] ❌ SQL client not available`);
      return null;
    }
    
    const seriesVal = series || "";
    
    // DEBUG: First check if there's ANY data for this country/indexType/series
    const countResult = await sql`
      SELECT COUNT(*) as count 
      FROM economic_indices 
      WHERE country = ${country} 
        AND index_type = ${indexType}
        AND COALESCE(series, '') = ${seriesVal}
    `;
    const totalCount = countResult.length > 0 ? parseInt(String(countResult[0].count)) : 0;
    console.log(`[getEconomicIndexFromDB] 📊 Total records for ${country} ${indexType} ${seriesVal || '(agg)'}: ${totalCount}`);
    
    if (totalCount > 0) {
      // Show available year_months
      const availableMonths = await sql`
        SELECT DISTINCT year_month 
        FROM economic_indices 
        WHERE country = ${country} 
          AND index_type = ${indexType} 
          AND COALESCE(series, '') = ${seriesVal}
        ORDER BY year_month DESC 
        LIMIT 10
      `;
      console.log(`[getEconomicIndexFromDB] 📅 Available months: ${availableMonths.map((r: any) => r.year_month).join(', ')}`);
    }
    
    // Try exact match first
    const exactResult = await sql`
      SELECT value 
      FROM economic_indices 
      WHERE country = ${country} 
        AND index_type = ${indexType} 
        AND COALESCE(series, '') = ${seriesVal}
        AND year_month = ${yearMonth}
      LIMIT 1
    `;

    if (exactResult.length > 0) {
      const value = Number(exactResult[0].value);
      console.log(`[getEconomicIndexFromDB] ✅ Exact match found: ${value} for ${yearMonth}`);
      return value;
    }
    
    console.log(`[getEconomicIndexFromDB] ⚠️ No exact match for ${yearMonth}, trying fallback...`);

    // Fallback: get latest value before OR AFTER requested month (closest match)
    // First try before, then try after if no data found
    const latestBeforeResult = await sql`
      SELECT value, year_month
      FROM economic_indices 
      WHERE country = ${country} 
        AND index_type = ${indexType} 
        AND COALESCE(series, '') = ${seriesVal}
        AND year_month <= ${yearMonth}
      ORDER BY year_month DESC
      LIMIT 1
    `;

    if (latestBeforeResult.length > 0) {
      const value = Number(latestBeforeResult[0].value);
      const foundMonth = latestBeforeResult[0].year_month;
      console.log(`[getEconomicIndexFromDB] ✅ Using closest value before ${yearMonth}: ${value} from ${foundMonth}`);
      return value;
    }

    // If no data before, try after (for future dates or missing historical data)
    const latestAfterResult = await sql`
      SELECT value, year_month
      FROM economic_indices 
      WHERE country = ${country} 
        AND index_type = ${indexType} 
        AND COALESCE(series, '') = ${seriesVal}
        AND year_month >= ${yearMonth}
      ORDER BY year_month ASC
      LIMIT 1
    `;

    if (latestAfterResult.length > 0) {
      const value = Number(latestAfterResult[0].value);
      const foundMonth = latestAfterResult[0].year_month;
      console.log(`[getEconomicIndexFromDB] ✅ Using closest value after ${yearMonth}: ${value} from ${foundMonth}`);
      return value;
    }

    // No data found
    console.log(`[getEconomicIndexFromDB] ❌ No data found for ${country} ${indexType} ${yearMonth} (tried before and after)`);
    return null;
  } catch (error) {
    console.error(`[getEconomicIndexFromDB] Error:`, error);
    return null;
  }
}

/**
 * Bulk insert economic indices (for ETL/cron jobs)
 * 
 * @param indices - Array of economic index data to insert
 */
export async function insertEconomicIndices(
  indices: Array<{
    country: CountryCode;
    indexType: EconomicIndexType;
    yearMonth: string;
    value: number;
    series?: string;
    source?: string;
    sourceUrl?: string;
    isVerified?: boolean;
  }>
): Promise<void> {
  if (indices.length === 0) return;

  const { getSql } = await import('@/lib/db/client');
  const sql = getSql();
  if (!sql) {
    throw new Error("Database connection not available");
  }

  try {
    const BATCH_SIZE = 50;
    let inserted = 0;
    const now = new Date();

    for (let i = 0; i < indices.length; i += BATCH_SIZE) {
      const batch = indices.slice(i, i + BATCH_SIZE);
      await sql`BEGIN`;
      try {
        for (const idx of batch) {
          await sql`
            INSERT INTO economic_indices (country, index_type, year_month, value, series, source, source_url, fetch_date, is_verified)
            VALUES (
              ${idx.country},
              ${idx.indexType},
              ${idx.yearMonth},
              ${idx.value},
              ${idx.series ?? ""},
              ${idx.source ?? null},
              ${idx.sourceUrl ?? null},
              ${now},
              ${idx.isVerified ?? false}
            )
            ON CONFLICT (country, index_type, series, year_month)
            DO UPDATE SET
              value = EXCLUDED.value,
              source = EXCLUDED.source,
              source_url = EXCLUDED.source_url,
              fetch_date = EXCLUDED.fetch_date,
              is_verified = EXCLUDED.is_verified,
              updated_at = CURRENT_TIMESTAMP
          `;
        }
        await sql`COMMIT`;
      } catch (batchErr) {
        await sql`ROLLBACK`;
        throw batchErr;
      }
      inserted += batch.length;
      if (inserted % 500 === 0 || inserted === indices.length) {
        console.log(`  Progress: ${inserted}/${indices.length}...`);
      }
    }

    console.log(`[insertEconomicIndices] ✅ Inserted ${indices.length} indices`);
  } catch (error) {
    await sql`ROLLBACK`;
    console.error(`[insertEconomicIndices] ❌ Error:`, error);
    throw error;
  }
}

/**
 * Log ETL job execution
 */
export async function logETLJob(
  jobName: string,
  status: "running" | "success" | "failed" | "skipped",
  recordsUpdated: number = 0,
  errorMessage?: string,
  executionTimeMs?: number
): Promise<void> {
  try {
    if (status === "running") {
      // Insert new running job
      await db.query(
        `INSERT INTO etl_job_logs (job_name, status, records_updated, started_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [jobName, status, recordsUpdated]
      );
    } else {
      // Update existing job or insert completed job
      await db.query(
        `INSERT INTO etl_job_logs (job_name, status, records_updated, error_message, execution_time_ms, started_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT DO NOTHING`,
        [jobName, status, recordsUpdated, errorMessage || null, executionTimeMs || null]
      );
    }
  } catch (error) {
    console.error(`[logETLJob] Error:`, error);
    // Don't throw - logging failure shouldn't break ETL
  }
}
