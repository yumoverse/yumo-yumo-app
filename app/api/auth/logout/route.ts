import { NextResponse } from "next/server";
import { buildCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const isProduction = process.env.NODE_ENV === "production";
  const opts = buildCookieOptions(isProduction);
  res.cookies.set({ ...opts, value: "", maxAge: 0 });
  return res;
}
