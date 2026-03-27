/**
 * User authentication storage (username, password hash)
 * Uses Neon PostgreSQL database if available, falls back to in-memory storage
 * SERVER-ONLY: Do not import in client components
 */

// Prevent import in browser
if (typeof window !== "undefined") {
  throw new Error("user-auth-storage is a server-only module. Do not import in client components.");
}

import { getSql } from "@/lib/db/client";
import bcrypt from "bcryptjs";

// Track if table creation has been attempted
let tableCreationAttempted = false;

// Check if database is available
function isDatabaseAvailable(): boolean {
  if (typeof window !== "undefined") {
    return false;
  }
  return !!process.env.DATABASE_URL;
}

/**
 * Ensure users table exists in database
 */
async function ensureUsersTable(): Promise<boolean> {
  console.log("[user-auth-storage] ensureUsersTable called");
  console.log("[user-auth-storage] Database available:", isDatabaseAvailable());
  
  // Get SQL client dynamically (lazy loading)
  const sql = getSql();
  console.log("[user-auth-storage] SQL client available:", !!sql);
  console.log("[user-auth-storage] Table creation already attempted:", tableCreationAttempted);
  
  if (!isDatabaseAvailable() || !sql) {
    console.warn("[user-auth-storage] Database not available, cannot ensure table");
    return false;
  }

  // Note: We always check columns even if table exists, in case schema needs migration

  try {
    console.log("[user-auth-storage] Checking if users table exists...");
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `;

    console.log("[user-auth-storage] Table exists check result:", tableExists[0]?.exists);

    if (tableExists[0].exists) {
      console.log("[user-auth-storage] Users table exists, checking columns...");
      
      // Check if password_hash column exists
      const columnExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'password_hash'
        )
      `;
      
      console.log("[user-auth-storage] password_hash column exists:", columnExists[0]?.exists);
      
      if (!columnExists[0].exists) {
        console.log("[user-auth-storage] password_hash column missing, adding it...");
        await sql`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
        `;
        console.log("[user-auth-storage] ✅ password_hash column added");
      } else {
        // Check if column allows NULL and update if needed
        const columnInfo = await sql`
          SELECT is_nullable 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'password_hash'
        `;
        
        if (columnInfo.length > 0 && columnInfo[0].is_nullable === 'YES') {
          console.log("[user-auth-storage] password_hash column allows NULL, but we can't change it to NOT NULL if there are NULL values.");
          console.log("[user-auth-storage] Please run fix-null-password-hashes.ts script to fix existing NULL values first.");
        }
      }
      
      // Check and add other columns if missing
      const createdAtExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'created_at'
        )
      `;
      
      if (!createdAtExists[0].exists) {
        console.log("[user-auth-storage] created_at column missing, adding it...");
        await sql`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `;
        console.log("[user-auth-storage] ✅ created_at column added");
      }
      
      const updatedAtExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'updated_at'
        )
      `;
      
      if (!updatedAtExists[0].exists) {
        console.log("[user-auth-storage] updated_at column missing, adding it...");
        await sql`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `;
        console.log("[user-auth-storage] ✅ updated_at column added");
      }
      
      // Ensure index exists
      await sql`
        CREATE INDEX IF NOT EXISTS idx_users_updated_at 
        ON users(updated_at)
      `;
      console.log("[user-auth-storage] Index ensured");
      
      console.log("[user-auth-storage] ✅ Users table schema verified and updated");
      tableCreationAttempted = true;
      return true;
    }

    console.log("[user-auth-storage] Users table not found, creating...");
    
    await sql`
      CREATE TABLE users (
        username VARCHAR(255) PRIMARY KEY,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("[user-auth-storage] Users table created");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_updated_at 
      ON users(updated_at)
    `;
    console.log("[user-auth-storage] Index created");

    console.log("[user-auth-storage] ✅ Users table created successfully");
    tableCreationAttempted = true;
    return true;
  } catch (error: any) {
    console.error("[user-auth-storage] ❌ Error in ensureUsersTable:");
    console.error("[user-auth-storage] Error message:", error?.message);
    console.error("[user-auth-storage] Error code:", error?.code);
    console.error("[user-auth-storage] Error stack:", error?.stack);
    
    if (error.code === "42P07" || error.message?.includes("already exists")) {
      console.log("[user-auth-storage] Table already exists (race condition), treating as success");
      tableCreationAttempted = true;
      return true;
    }
    
    console.error("[user-auth-storage] Failed to create users table");
    tableCreationAttempted = true;
    return false;
  }
}

/**
 * Seed users from env (optional). Format: JSON array of { username, password }.
 * Set SEED_USERS_JSON in .env.local for local/dev; never commit credentials.
 */
function getSeedUsersFromEnv(): { username: string; password: string }[] | null {
  const raw = process.env.SEED_USERS_JSON;
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (u): u is { username: string; password: string } =>
        u != null && typeof u === "object" && typeof (u as any).username === "string" && typeof (u as any).password === "string"
    );
  } catch {
    return null;
  }
}

// 5-minute cache: (username -> { hash, expiry }) to skip bcrypt on repeated login
const LOGIN_CACHE_TTL_MS = 5 * 60 * 1000;
const loginCache = new Map<string, { hash: string; expiry: number }>();

// Login must tolerate cold Neon / slow local networks; 2s caused false "invalid password" (see DB_TIMEOUT in logs).
const DB_TIMEOUT_MS = 15_000;
const BCRYPT_ROUNDS = 8;

async function rehashToCost8InBackground(
  username: string,
  password: string,
  sql: NonNullable<ReturnType<typeof getSql>>
): Promise<void> {
  try {
    const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await sql`
      UPDATE users SET password_hash = ${newHash}, updated_at = CURRENT_TIMESTAMP WHERE username = ${username}
    `;
    loginCache.set(username, {
      hash: newHash,
      expiry: Date.now() + LOGIN_CACHE_TTL_MS,
    });
  } catch {
    // ignore
  }
}

/**
 * Verify user password (no ensureUsersTable on login path for speed)
 */
export async function verifyPassword(username: string, password: string): Promise<boolean> {
  const sql = getSql();

  if (isDatabaseAvailable() && sql) {
    try {
      const rowsPromise = sql`
        SELECT password_hash FROM users WHERE username = ${username}
      `;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DB_TIMEOUT")), DB_TIMEOUT_MS)
      );
      const rows = await Promise.race([rowsPromise, timeoutPromise]) as Awaited<typeof rowsPromise>;
      
      console.log("[user-auth-storage] Database query result - rows found:", rows.length);
      
      if (rows.length > 0) {
        console.log("[user-auth-storage] User found in database, comparing password hash...");
        const passwordHash = rows[0].password_hash;
        
        // Check if password_hash is null or undefined
        if (passwordHash === null || passwordHash === undefined) {
          console.warn("[user-auth-storage] ⚠️ password_hash is NULL for user:", username);
          console.log("[user-auth-storage] Falling back to hardcoded array for backward compatibility...");
          // Fall through to fallback check below
        } else {
          // Handle different PostgreSQL return types (string, Buffer, object)
          let passwordHashString: string;
          if (typeof passwordHash === 'string') {
            passwordHashString = passwordHash;
          } else if (Buffer.isBuffer(passwordHash)) {
            passwordHashString = passwordHash.toString('utf-8');
          } else if (passwordHash && typeof passwordHash === 'object' && 'toString' in passwordHash) {
            passwordHashString = passwordHash.toString();
          } else {
            passwordHashString = String(passwordHash);
          }
          
          // Final null check after conversion
          if (!passwordHashString || passwordHashString === 'null' || passwordHashString === 'undefined') {
            console.warn("[user-auth-storage] ⚠️ password_hash could not be converted to string for user:", username);
            console.log("[user-auth-storage] Falling back to hardcoded array for backward compatibility...");
            // Fall through to fallback check below
          } else {
            const cached = loginCache.get(username);
            if (cached && cached.hash === passwordHashString && cached.expiry > Date.now()) {
              return true;
            }
            const isValid = await bcrypt.compare(password, passwordHashString);
            if (isValid) {
              loginCache.set(username, {
                hash: passwordHashString,
                expiry: Date.now() + LOGIN_CACHE_TTL_MS,
              });
              if (
                (passwordHashString.startsWith("$2a$10$") ||
                  passwordHashString.startsWith("$2b$10$")) &&
                sql
              ) {
                void rehashToCost8InBackground(username, password, sql);
              }
              return true;
            }
            
            return false;
          }
        }
      }
      console.log("[user-auth-storage] User not found in database, checking SEED_USERS_JSON...");
      // Fall through to seed fallback
    } catch (error: any) {
      console.warn("[user-auth-storage] Failed to verify password from database:", error?.message);
      // Fall through to seed fallback
    }
  } else {
    console.log("[user-auth-storage] Database not available");
  }

  // Optional fallback: SEED_USERS_JSON (env only, never commit credentials)
  const seedUsers = getSeedUsersFromEnv();
  if (!seedUsers || seedUsers.length === 0) return false;
  const fallbackUser = seedUsers.find((u) => u.username === username && u.password === password);
  if (!fallbackUser) return false;

  // Seed match: if DB has this user with null hash, update it for next time
  if (isDatabaseAvailable() && sql) {
    try {
      const userInfo = await sql`
        SELECT username, password_hash FROM users WHERE username = ${username}
      `;
      if (userInfo.length > 0) {
        const passwordHash = userInfo[0].password_hash;
        if (passwordHash === null || passwordHash === undefined || passwordHash === "") {
          const newPasswordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
          await sql`
            UPDATE users SET password_hash = ${newPasswordHash}, updated_at = CURRENT_TIMESTAMP WHERE username = ${username}
          `;
        } else {
          return false; // user has set password, reject seed match
        }
      }
    } catch {
      // continue and return true
    }
  }
  return true;
}

/**
 * Update user password
 */
export async function updatePassword(username: string, newPassword: string): Promise<void> {
  console.log("[user-auth-storage] updatePassword called for user:", username);
  console.log("[user-auth-storage] Database available:", isDatabaseAvailable());
  
  // Get SQL client dynamically (lazy loading)
  const sql = getSql();
  console.log("[user-auth-storage] SQL client available:", !!sql);
  
  if (isDatabaseAvailable() && sql) {
    try {
      console.log("[user-auth-storage] Ensuring users table exists...");
      const tableExists = await ensureUsersTable();
      console.log("[user-auth-storage] Users table exists:", tableExists);
      
      if (!tableExists) {
        throw new Error("Failed to create or verify users table");
      }
      
      console.log("[user-auth-storage] Hashing new password...");
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      console.log("[user-auth-storage] Password hashed successfully");
      
      console.log("[user-auth-storage] Inserting/updating password in database...");
      await sql`
        INSERT INTO users (username, password_hash, updated_at)
        VALUES (${username}, ${passwordHash}, CURRENT_TIMESTAMP)
        ON CONFLICT (username) 
        DO UPDATE SET 
          password_hash = EXCLUDED.password_hash,
          updated_at = CURRENT_TIMESTAMP
      `;
      loginCache.delete(username);
      console.log("[user-auth-storage] ✅ Password updated successfully for user:", username);
    } catch (error: any) {
      console.error("[user-auth-storage] ❌ Failed to update password:");
      console.error("[user-auth-storage] Error message:", error?.message);
      console.error("[user-auth-storage] Error code:", error?.code);
      console.error("[user-auth-storage] Error stack:", error?.stack);
      throw error;
    }
  } else {
    const errorMsg = "Database not available - DATABASE_URL not set or SQL client not initialized";
    console.error("[user-auth-storage] ❌", errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Initialize users table with default users (migration from hardcoded array)
 * This should be called once during setup
 */
export async function initializeDefaultUsers(): Promise<void> {
  console.log("[user-auth-storage] initializeDefaultUsers called");
  console.log("[user-auth-storage] Database available:", isDatabaseAvailable());
  
  // Get SQL client dynamically (lazy loading)
  const sql = getSql();
  console.log("[user-auth-storage] SQL client available:", !!sql);
  
  if (!isDatabaseAvailable() || !sql) {
    console.warn("[user-auth-storage] Database not available, skipping user initialization");
    return;
  }

  try {
    await ensureUsersTable();
    const defaultUsers = getSeedUsersFromEnv();
    if (!defaultUsers || defaultUsers.length === 0) {
      console.log("[user-auth-storage] SEED_USERS_JSON not set, skipping default user initialization");
      return;
    }

    // Only insert users that don't exist yet
    console.log("[user-auth-storage] Processing", defaultUsers.length, "default users...");
    let initializedCount = 0;
    let skippedCount = 0;
    
    for (const user of defaultUsers) {
      try {
        const existing = await sql`
          SELECT username, password_hash FROM users WHERE username = ${user.username}
        `;
        
        if (existing.length === 0) {
          console.log("[user-auth-storage] Initializing user:", user.username);
          const passwordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
          await sql`
            INSERT INTO users (username, password_hash)
            VALUES (${user.username}, ${passwordHash})
          `;
          console.log("[user-auth-storage] ✅ Initialized user:", user.username);
          initializedCount++;
        } else {
          // Check if password_hash is null or empty
          const existingUser = existing[0];
          const passwordHash = existingUser.password_hash;
          
          if (passwordHash === null || passwordHash === undefined || passwordHash === '') {
            console.log("[user-auth-storage] User exists but password_hash is null, updating:", user.username);
            const newPasswordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
            await sql`
              UPDATE users 
              SET password_hash = ${newPasswordHash}, updated_at = CURRENT_TIMESTAMP
              WHERE username = ${user.username}
            `;
            console.log("[user-auth-storage] ✅ Updated password_hash for user:", user.username);
            initializedCount++;
          } else {
            console.log("[user-auth-storage] User already exists with valid password, skipping:", user.username);
            skippedCount++;
          }
        }
      } catch (error: any) {
        console.error("[user-auth-storage] ❌ Failed to initialize user:", user.username, error?.message);
      }
    }
    
    console.log("[user-auth-storage] ✅ Default users initialization complete:");
    console.log("[user-auth-storage]   - Initialized:", initializedCount);
    console.log("[user-auth-storage]   - Skipped (already exist):", skippedCount);
  } catch (error: any) {
    console.error("[user-auth-storage] ❌ Failed to initialize default users:");
    console.error("[user-auth-storage] Error message:", error?.message);
    console.error("[user-auth-storage] Error code:", error?.code);
    console.error("[user-auth-storage] Error stack:", error?.stack);
    throw error; // Re-throw so caller knows initialization failed
  }
}
