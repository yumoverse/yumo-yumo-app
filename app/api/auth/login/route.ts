import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/storage/user-auth-storage";
import { warmUpConnection } from "@/lib/db/client";
import { signSession, buildCookieOptions } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    await warmUpConnection();
    const isValid = await verifyPassword(username, password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const token = await signSession(username);
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOpts = buildCookieOptions(isProduction);

    const response = NextResponse.json(
      { success: true, message: "Login successful", username },
      { status: 200 }
    );

    response.cookies.set({ ...cookieOpts, value: token });

    return response;
  } catch (error: unknown) {
    console.error("[api/auth/login] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
