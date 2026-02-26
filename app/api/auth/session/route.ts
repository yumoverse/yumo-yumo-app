import { NextResponse } from "next/server";

export async function GET() {
  // Return an empty session shape when no user is authenticated
  return NextResponse.json({ user: null, expires: null });
}

export default GET;


