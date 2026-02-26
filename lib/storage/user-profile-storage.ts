/**
 * Shared storage for user profile data (displayName, gender, birthDate)
 * Uses Neon PostgreSQL database if available, falls back to file-based or in-memory storage
 * SERVER-ONLY: Do not import in client components
 */

// Prevent import in browser
if (typeof window !== "undefined") {
  throw new Error("user-profile-storage is a server-only module. Do not import in client components.");
}

import { promises as fs } from "fs";
import path from "path";
import { sql } from "@/lib/db/client";

const DATA_DIR = path.join(process.cwd(), ".data");
const USER_PROFILES_FILE = path.join(DATA_DIR, "user-profiles.json");

export interface UserProfile {
  username: string;
  displayName?: string;
  gender?: string;
  birthDate?: string;
  honor?: number; // Honor score 0-100, default 50 (Honor system)
  occupation?: string;
}

// In-memory storage fallback (for Vercel without database)
let memoryProfiles: UserProfile[] = [];

// Track if table creation has been attempted (to avoid repeated attempts)
let tableCreationAttempted = false;

// Check if database is available
function isDatabaseAvailable(): boolean {
  if (typeof window !== "undefined") {
    return false; // Never use database in browser
  }
  return !!process.env.DATABASE_URL;
}

/**
 * Ensure user_profiles table exists in database
 * This is called automatically before database operations
 */
async function ensureUserProfilesTable(): Promise<boolean> {
  if (!isDatabaseAvailable() || !sql) {
    return false;
  }

  // Only attempt once per process to avoid repeated checks
  if (tableCreationAttempted) {
    return true;
  }

  try {
    // Check if table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles'
      )
    `;

    if (tableExists[0].exists) {
      tableCreationAttempted = true;
      return true;
    }

    // Table doesn't exist, create it
    console.log("[user-profile-storage] user_profiles table not found, creating...");
    
    await sql`
      CREATE TABLE user_profiles (
        username VARCHAR(255) PRIMARY KEY,
        display_name VARCHAR(255),
        gender VARCHAR(50),
        birth_date DATE,
        honor INTEGER DEFAULT 50,
        occupation VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at 
      ON user_profiles(updated_at)
    `;

    console.log("[user-profile-storage] ✅ user_profiles table created successfully");
    tableCreationAttempted = true;
    return true;
  } catch (error: any) {
    // If table already exists (race condition), that's fine
    if (error.code === "42P07" || error.message?.includes("already exists")) {
      tableCreationAttempted = true;
      return true;
    }
    
    console.error("[user-profile-storage] Failed to create user_profiles table:", error.message);
    tableCreationAttempted = true; // Don't retry on error
    return false;
  }
}

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

export async function readUserProfiles(): Promise<UserProfile[]> {
  // Try database first
  if (isDatabaseAvailable() && sql) {
    try {
      // Ensure table exists before querying
      await ensureUserProfilesTable();
      
      const rows = await sql`
        SELECT username, display_name, gender, birth_date, honor, occupation
        FROM user_profiles 
        ORDER BY updated_at DESC
      `;
      return rows.map((row: any) => ({
        username: row.username,
        displayName: row.display_name || undefined,
        gender: row.gender || undefined,
        birthDate: row.birth_date || undefined,
        honor: row.honor != null ? Number(row.honor) : 50,
        occupation: row.occupation || undefined,
      }));
    } catch (error) {
      console.error("[user-profile-storage] Failed to read from database, falling back to file storage:", error);
      // Fall through to file storage
    }
  }

  // Fallback to file storage
  const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;
  
  if (isVercel) {
    return memoryProfiles;
  }
  
  await ensureDataDir();
  try {
    const data = await fs.readFile(USER_PROFILES_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

export async function writeUserProfiles(profiles: UserProfile[]): Promise<void> {
  // Try database first
  if (isDatabaseAvailable() && sql) {
    try {
      // Ensure table exists before writing
      await ensureUserProfilesTable();
      
      // Upsert for each profile
      for (const profile of profiles) {
        await sql`
          INSERT INTO user_profiles (username, display_name, gender, birth_date, occupation, updated_at)
          VALUES (${profile.username}, ${profile.displayName || null}, ${profile.gender || null}, ${profile.birthDate || null}, ${profile.occupation || null}, CURRENT_TIMESTAMP)
          ON CONFLICT (username) 
          DO UPDATE SET 
            display_name = EXCLUDED.display_name,
            gender = EXCLUDED.gender,
            birth_date = EXCLUDED.birth_date,
            occupation = EXCLUDED.occupation,
            updated_at = CURRENT_TIMESTAMP
        `;
      }
      console.log("[user-profile-storage] Saved user profiles to database:", profiles.length);
      return;
    } catch (error) {
      console.error("[user-profile-storage] Failed to write to database, falling back to file storage:", error);
      // Fall through to file storage
    }
  }

  // Fallback to file storage
  const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;
  
  if (isVercel) {
    console.log("[user-profile-storage] Vercel detected - using in-memory storage. Profile count:", profiles.length);
    memoryProfiles = profiles;
    return;
  }
  
  await ensureDataDir();
  try {
    await fs.writeFile(USER_PROFILES_FILE, JSON.stringify(profiles, null, 2), "utf-8");
  } catch (error: any) {
    console.error("[user-profile-storage] Failed to write to user-profiles.json:", error);
    // If it's a permission error, it's likely Vercel - fallback to memory
    if (error.code === "EACCES" || error.code === "EROFS") {
      console.warn("[user-profile-storage] Read-only filesystem detected (likely Vercel). Using in-memory storage as fallback.");
      memoryProfiles = profiles;
      return; // Don't throw, allow API to return success
    }
    throw error;
  }
}

export async function getUserProfile(username: string): Promise<UserProfile | null> {
  const profiles = await readUserProfiles();
  const profile = profiles.find((p) => p.username === username);
  return profile || null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const profiles = await readUserProfiles();
  const existingIndex = profiles.findIndex((p) => p.username === profile.username);

  if (existingIndex >= 0) {
    // Update existing profile, merge with existing data
    profiles[existingIndex] = {
      ...profiles[existingIndex],
      ...profile,
    };
  } else {
    profiles.push(profile);
  }
  await writeUserProfiles(profiles);
}

