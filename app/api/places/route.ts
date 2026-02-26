import { NextResponse } from "next/server";

/**
 * Google Places API Route (Server-side proxy)
 * Client-side'dan Places API çağrılarını proxy eder
 * API key'i gizli tutmak için server-side'da çalışır
 * 
 * GET /api/places?query=restaurant&location=lat,lng
 * POST /api/places/autocomplete
 * POST /api/places/details
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");
    const location = searchParams.get("location");
    const type = searchParams.get("type") || "establishment";

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error("[api/places] GOOGLE_PLACES_API_KEY not configured");
      return NextResponse.json(
        { error: "Places API not configured" },
        { status: 500 }
      );
    }

    // Build Places API URL
    let placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    
    if (location) {
      placesUrl += `&location=${location}&radius=5000`;
    }
    
    if (type) {
      placesUrl += `&type=${type}`;
    }

    const response = await fetch(placesUrl);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[api/places] Google Places API error:", errorData);
      return NextResponse.json(
        {
          error: "Failed to fetch places",
          details: errorData,
        },
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
      success: true,
      results: data.results || [],
      status: data.status,
    });
  } catch (error: any) {
    console.error("[api/places] error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch places",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}

// Autocomplete endpoint
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { input, location, sessionToken } = body;

    if (!input) {
      return NextResponse.json(
        { error: "Input parameter is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Places API not configured" },
        { status: 500 }
      );
    }

    // Places Autocomplete API
    let autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}`;
    
    if (location) {
      autocompleteUrl += `&location=${location}&radius=5000`;
    }
    
    if (sessionToken) {
      autocompleteUrl += `&sessiontoken=${sessionToken}`;
    }

    const response = await fetch(autocompleteUrl);

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { error: "Failed to autocomplete", details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      predictions: data.predictions || [],
      status: data.status,
    });
  } catch (error: any) {
    console.error("[api/places] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to process autocomplete request",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}






