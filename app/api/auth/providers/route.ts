import { NextResponse } from "next/server";

export async function GET() {
  // Return a providers list similar to NextAuth expected shape
  return NextResponse.json([
    {
      id: "credentials",
      name: "Credentials",
      type: "credentials",
      signinUrl: "/api/auth/signin/credentials",
      callbackUrl: "/",
    },
  ]);
}

export default GET;


