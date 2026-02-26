import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";

/**
 * AI API Route
 * For receipt analysis, expense categorization, and other AI operations
 *
 * POST /api/llm
 * Body: {
 *   provider: "openai" | "anthropic",
 *   prompt: string,
 *   model?: string,
 *   temperature?: number
 * }
 */
export async function POST(req: Request) {
  const username = await getSessionUsername();
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { provider = "openai", prompt, model, temperature = 0.7 } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    let response;
    
    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "AI API key not configured" },
          { status: 500 }
        );
      }

      const openaiUrl = "https://api.openai.com/v1/chat/completions";
      
      response = await fetch(openaiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || process.env.AI_MODEL_NAME || "default-model",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that analyzes receipts and expenses. Provide structured, accurate responses in JSON format when possible.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("[api/llm] AI service error:", errorData);
        return NextResponse.json(
          {
            error: "AI API error",
            details: errorData,
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json({
        success: true,
        provider: "openai",
        content: data.choices[0]?.message?.content || "",
        usage: data.usage,
      });
    } 
    
    else if (provider === "anthropic") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "Anthropic API key not configured" },
          { status: 500 }
        );
      }

      const anthropicUrl = "https://api.anthropic.com/v1/messages";
      
      response = await fetch(anthropicUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model || process.env.AI_MODEL_NAME || "default-model",
          max_tokens: 2000,
          temperature,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("[api/llm] Anthropic error:", errorData);
        return NextResponse.json(
          {
            error: "Anthropic API error",
            details: errorData,
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json({
        success: true,
        provider: "anthropic",
        content: data.content[0]?.text || "",
        usage: data.usage,
      });
    } 
    
    else {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("[api/llm] error:", error);
    return NextResponse.json(
      {
        error: "Failed to process AI request",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}






