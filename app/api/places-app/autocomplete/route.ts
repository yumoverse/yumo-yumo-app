import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps API key not configured" },
        { status: 500 }
      );
    }

    const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=${apiKey}&types=establishment`;

    const response = await fetch(autocompleteUrl);

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { error: "Failed to fetch autocomplete", details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return NextResponse.json(
        {
          error: `Places API error: ${data.status}`,
          details: data.error_message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      suggestions: data.predictions || [],
    });
  } catch (error: any) {
    console.error("[api/places/autocomplete] error:", error);
    return NextResponse.json(
      {
        error: "Failed to process autocomplete request",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}






