import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { verifyPassword, updatePassword, initializeDefaultUsers } from "@/lib/storage/user-auth-storage";

export async function POST(req: Request) {
  try {
    console.log("[api/user/change-password] Starting password change request");
    
    // Get username from cookie
    const username = await getSessionUsername();

    console.log("[api/user/change-password] Username from cookie:", username || "NOT FOUND");

    if (!username) {
      console.error("[api/user/change-password] No username in cookie - unauthorized");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    console.log("[api/user/change-password] Request body received:", {
      hasCurrentPassword: !!currentPassword,
      hasNewPassword: !!newPassword,
      newPasswordLength: newPassword?.length || 0,
    });

    // Validate inputs
    if (!currentPassword || !newPassword) {
      console.error("[api/user/change-password] Missing required fields");
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      console.error("[api/user/change-password] New password too short:", newPassword.length);
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Ensure default users are initialized (in case user is not yet in database)
    console.log("[api/user/change-password] Initializing default users...");
    try {
      await initializeDefaultUsers();
      console.log("[api/user/change-password] Default users initialized successfully");
    } catch (error: any) {
      console.warn("[api/user/change-password] Failed to initialize users, continuing:", error?.message || error);
    }

    // Verify current password
    console.log("[api/user/change-password] Verifying current password for user:", username);
    const isValid = await verifyPassword(username, currentPassword);
    console.log("[api/user/change-password] Password verification result:", isValid);
    
    if (!isValid) {
      console.error("[api/user/change-password] Current password verification failed");
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    // Update password (this will create user in database if not exists)
    console.log("[api/user/change-password] Updating password for user:", username);
    try {
      await updatePassword(username, newPassword);
      console.log("[api/user/change-password] Password updated successfully");
    } catch (error: any) {
      console.error("[api/user/change-password] Failed to update password:", error?.message || error);
      console.error("[api/user/change-password] Error stack:", error?.stack);
      throw error; // Re-throw to be caught by outer catch
    }

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error: any) {
    console.error("[api/user/change-password] POST error:", error);
    console.error("[api/user/change-password] Error message:", error?.message);
    console.error("[api/user/change-password] Error stack:", error?.stack);
    console.error("[api/user/change-password] Error name:", error?.name);
    console.error("[api/user/change-password] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    return NextResponse.json(
      {
        error: "Failed to change password",
        details: error?.message ?? String(error),
        stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
