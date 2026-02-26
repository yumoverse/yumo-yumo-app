import { NextResponse } from "next/server";
import OpenAI from "openai";

const aiService = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(req: Request) {
  try {
    // Check if AI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error("[api/llm/fallback] AI_API_KEY not configured");
      return NextResponse.json(
        { error: "AI API key not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const {
      ocrText,
      userTotal,
      userCategory,
      currency = "TRY",
    } = body;

    if (!ocrText) {
      return NextResponse.json(
        { error: "ocrText is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `
You are a receipt analysis engine.

Your task:
- Read raw OCR text of a receipt
- Identify the FINAL PAID TOTAL (what customer paid)
- Identify receipt category (market, restaurant, cafe, fastfood, electronics, other)
- Detect VAT status:
  - If VAT explicitly shown → vatMode="EXPLICIT"
  - If VAT mentioned but not numeric → vatMode="HIDDEN"
  - If no VAT reference → vatMode="UNKNOWN"

Rules:
- Ignore item-level prices unless no total exists
- Prefer keywords like: TOPLAM, GENEL TOPLAM, NET, YEKUN, GRAND TOTAL
- Never hallucinate numbers
- Return strict JSON only
`;

    const userPrompt = `
OCR TEXT:
${ocrText}

User selected:
- total: ${userTotal ?? "N/A"}
- category: ${userCategory ?? "N/A"}
- currency: ${currency}

Return JSON with this schema:
{
  "detectedTotal": number | null,
  "currency": string,
  "category": string | null,
  "vatMode": "EXPLICIT" | "HIDDEN" | "UNKNOWN",
  "confidence": number (0-1),
  "reasoning": string
}
`;

    const modelName = process.env.AI_MODEL_NAME || "default-model";
    const completion = await aiService.chat.completions.create({
      model: modelName,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(raw || "{}");
    } catch {
      return NextResponse.json(
        { error: "AI service returned invalid JSON", raw },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      ai: parsed,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "AI service fallback failed", detail: err.message },
      { status: 500 }
    );
  }
}
