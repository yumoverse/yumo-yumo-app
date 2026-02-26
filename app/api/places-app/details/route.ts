import { NextResponse } from "next/server";
import { mapPlacesTypesToCategory } from "@/lib/receipt/calculations";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get("placeId");

    if (!placeId) {
      return NextResponse.json(
        { error: "placeId parameter is required" },
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

    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&key=${apiKey}&fields=name,place_id,types,address_components,formatted_address,price_level`;

    const response = await fetch(detailsUrl);

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { error: "Failed to fetch place details", details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.status !== "OK") {
      return NextResponse.json(
        {
          error: `Places API error: ${data.status}`,
          details: data.error_message,
        },
        { status: 400 }
      );
    }

    const result = data.result;
    const category = mapPlacesTypesToCategory(result.types || []);
    
    // Extract country code from address_components
    let countryCode: string | undefined;
    const countryComponent = result.address_components?.find(
      (comp: any) => comp.types.includes("country")
    );
    if (countryComponent) {
      countryCode = countryComponent.short_name;
    }

    return NextResponse.json({
      name: result.name,
      placeId: result.place_id,
      types: result.types || [],
      category,
      country: countryCode,
      formattedAddress: result.formatted_address,
      priceLevel: result.price_level, // Google Places price_level (0-4)
    });
  } catch (error: any) {
    console.error("[api/places/details] error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch place details",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}






