/**
 * Neon PostgreSQL database client
 * SERVER-ONLY: Do not import in client components
 */

// Prevent import in browser
if (typeof window !== "undefined") {
  throw new Error("db/client is a server-only module. Do not import in client components.");
}

import { neon, neonConfig } from "@neondatabase/serverless";

// Enable connection caching for better performance
// This helps with connection reuse in serverless environments
neonConfig.fetchConnectionCache = true;

// Lazy initialization: Get DATABASE_URL when needed (allows dotenv to load first)
function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL || null;
}

// Create Neon SQL client (lazy initialization)
// NOTE: We don't cache _sql globally because DATABASE_URL might be loaded after module initialization
// Instead, we check DATABASE_URL on every call to ensure it's loaded
export function getSql() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    console.warn("[db/client] DATABASE_URL not set. Database operations will fail.");
    return null;
  }
  // Create new client each time (neon() handles connection pooling internally)
  return neon(databaseUrl);
}

// Export sql - but it's initialized lazily via getSql() when first accessed
// WARNING: This will initialize on first import if used directly
// For better lazy loading, use getSql() function instead
export const sql = getSql();

/** Normalize Neon/pg query result to rows array (handles both array and { rows } shapes). */
function normalizeQueryResult(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows))
    return (result as { rows: any[] }).rows;
  return [];
}

// Database wrapper for query-style operations (used by merchantTier, cityTier, economicIndex)
// WARNING: This uses sql.unsafe which requires careful parameter escaping
// TODO: Refactor merchantTier.ts, cityTier.ts, economicIndex.ts to use sql template literals directly
export const db = {
  query: async <T = any>(queryText: string, params?: any[]): Promise<{ rows: T[] }> => {
    const sqlClient = getSql();
    if (!sqlClient) {
      throw new Error("Database connection not available. DATABASE_URL is not set.");
    }

    // Use Neon's native parameterized query so RETURNING and encoding work correctly.
    // (unsafe() with manual $1 substitution was causing INSERT RETURNING to return no rows.)
    if (params && params.length > 0) {
      const result = await sqlClient.query(queryText, params);
      const rows = normalizeQueryResult(result);
      return { rows };
    }
    const result = await sqlClient.unsafe(queryText);
    const rows = normalizeQueryResult(result);
    return { rows };
  }
};

// Warm-up connection flag
let isWarmedUp = false;

/**
 * Warm up the database connection
 * Call this on app startup or before first critical query
 */
export async function warmUpConnection(): Promise<void> {
  const sqlClient = getSql();
  if (!sqlClient || isWarmedUp) return;
  
  try {
    await sqlClient`SELECT 1`;
    isWarmedUp = true;
    console.log("[db/client] ✅ Database connection warmed up");
  } catch (error) {
    // Silent fail - will retry on first real query
    console.warn("[db/client] Warm-up failed, will retry on first query:", error);
  }
}
