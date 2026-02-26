/**
 * Shared storage for user country data
 * Uses Neon PostgreSQL database if available, falls back to file-based or in-memory storage
 * SERVER-ONLY: Do not import in client components
 */

// Prevent import in browser
if (typeof window !== "undefined") {
  throw new Error("user-country-storage is a server-only module. Do not import in client components.");
}

import { promises as fs } from "fs";
import path from "path";
import { sql } from "@/lib/db/client";

const DATA_DIR = path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export interface UserCountry {
  username: string;
  country: string;
}

// In-memory storage fallback (for Vercel without database)
let memoryUsers: UserCountry[] = [];

// Check if database is available
function isDatabaseAvailable(): boolean {
  if (typeof window !== "undefined") {
    return false; // Never use database in browser
  }
  return !!process.env.DATABASE_URL;
}

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

export async function readUsers(): Promise<UserCountry[]> {
  // Try database first
  if (isDatabaseAvailable() && sql) {
    try {
      const rows = await sql`
        SELECT username, country 
        FROM users 
        ORDER BY updated_at DESC
      `;
      return rows.map((row: any) => ({
        username: row.username,
        country: row.country,
      }));
    } catch (error) {
      console.error("[user-country-storage] Failed to read from database, falling back to file storage:", error);
      // Fall through to file storage
    }
  }

  // Fallback to file storage
  const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;
  
  if (isVercel) {
    return memoryUsers;
  }
  
  await ensureDataDir();
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

export async function writeUsers(users: UserCountry[]): Promise<void> {
  // Try database first
  if (isDatabaseAvailable() && sql) {
    try {
      // Use a transaction-like approach: delete all and insert
      // For simplicity, we'll do upsert for each user
      for (const user of users) {
        await sql`
          INSERT INTO users (username, country, updated_at)
          VALUES (${user.username}, ${user.country}, CURRENT_TIMESTAMP)
          ON CONFLICT (username) 
          DO UPDATE SET 
            country = EXCLUDED.country,
            updated_at = CURRENT_TIMESTAMP
        `;
      }
      console.log("[user-country-storage] Saved users to database:", users.length);
      return;
    } catch (error) {
      console.error("[user-country-storage] Failed to write to database, falling back to file storage:", error);
      // Fall through to file storage
    }
  }

  // Fallback to file storage
  const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;
  
  if (isVercel) {
    console.log("[user-country-storage] Vercel detected - using in-memory storage. User count:", users.length);
    memoryUsers = users;
    return;
  }
  
  await ensureDataDir();
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (error: any) {
    console.error("[user-country-storage] Failed to write to users.json:", error);
    // If it's a permission error, it's likely Vercel - fallback to memory
    if (error.code === "EACCES" || error.code === "EROFS") {
      console.warn("[user-country-storage] Read-only filesystem detected (likely Vercel). Using in-memory storage as fallback.");
      memoryUsers = users;
      return; // Don't throw, allow API to return success
    }
    throw error;
  }
}

export async function getUserCountry(username: string): Promise<string | null> {
  const users = await readUsers();
  const user = users.find((u) => u.username === username);
  return user?.country || null;
}

export async function saveUserCountry(username: string, country: string): Promise<void> {
  const users = await readUsers();
  const existingIndex = users.findIndex((u) => u.username === username);

  if (existingIndex >= 0) {
    users[existingIndex].country = country;
  } else {
    users.push({ username, country });
  }
  await writeUsers(users);
}

