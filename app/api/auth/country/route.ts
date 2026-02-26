import { NextResponse } from "next/server";
import { readUsers, saveUserCountry } from "@/lib/storage/user-country-storage";
import { getSessionUsername } from "@/lib/auth/session";

export async function GET() {
  try {
    const username = await getSessionUsername();
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await readUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return NextResponse.json({ country: null });
    }

    return NextResponse.json({ country: user.country });
  } catch (error: any) {
    console.error("[api/auth/country] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user country" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const username = await getSessionUsername();
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { country } = body;

    if (!country) {
      return NextResponse.json(
        { error: "Country is required" },
        { status: 400 }
      );
    }

    // Validate country code (2-letter ISO code)
    if (country.length !== 2 || !/^[A-Z]{2}$/i.test(country)) {
      return NextResponse.json(
        { error: "Invalid country code. Must be a 2-letter ISO code (e.g., TR, TH, US)" },
        { status: 400 }
      );
    }

    // Normalize to uppercase
    const normalizedCountry = country.toUpperCase();

    // Always save for the authenticated session user — ignore any username in body
    await saveUserCountry(username, normalizedCountry);

    return NextResponse.json({ success: true, country: normalizedCountry });
  } catch (error: any) {
    console.error("[api/auth/country] error:", error);
    return NextResponse.json(
      { error: "Failed to save user country" },
      { status: 500 }
    );
  }
}
