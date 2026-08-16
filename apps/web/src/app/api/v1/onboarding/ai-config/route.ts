import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSessionFromRequest } from "@/server/auth-cookies";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are a widget configuration assistant. The user will paste markdown content 
(product docs, brand guidelines, website copy, or similar). 
Extract values for a chatbot widget configuration JSON object.

Return ONLY a valid JSON object with these optional fields (omit any you cannot determine):
{
  "branding": {
    "name": string,          // chatbot name from brand
    "gradientFrom": string,  // top gradient hex color matching brand
    "gradientTo": string,    // bottom gradient hex color
    "primaryTextColor": string,   // heading/primary text hex color
    "secondaryTextColor": string  // body text hex color
  },
  "messages": {
    "welcomeGreeting": string,    // personalized greeting, use {name} for visitor name
    "introMessages": string[],    // 2-4 short rotating intro lines
    "askTitle": string,           // ask card CTA title (e.g. "Ask a question")
    "askSubtitle": string,        // ask card subtitle
    "faqs": [                     // 2-5 FAQs extracted from the docs
      { "question": string, "answer": string }
    ]
  }
}

Rules:
- Only extract what you can reasonably infer from the provided markdown.
- Colors must be valid CSS hex values (#rrggbb). Only include colors if the markdown mentions specific brand colors.
- Keep greeting friendly and personalized (15 words max).
- Keep intro messages short (8 words max each).
- FAQs must be real questions a visitor would ask based on the content.
- Return only the JSON object, no markdown fences, no explanation.`;

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = (await req.json()) as { markdown?: string; mode?: string };
    const markdown = typeof body.markdown === "string" ? body.markdown.trim() : "";

    if (!markdown || markdown.length < 20) {
      return NextResponse.json(
        { success: false, error: "Please provide at least some markdown content." },
        { status: 400 },
      );
    }

    if (markdown.length > 12_000) {
      return NextResponse.json(
        { success: false, error: "Markdown too long — please keep it under 12,000 characters." },
        { status: 400 },
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEYS?.split(/[\s,]+/).find(Boolean) ??
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_API_KEYS?.split(/[\s,]+/).find(Boolean) ??
      process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "AI service not configured." },
        { status: 503 },
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const prompt = `${SYSTEM_PROMPT}\n\nMarkdown content:\n\`\`\`markdown\n${markdown}\n\`\`\``;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    let parsed: unknown;
    try {
      // Strip markdown fences if the model added them anyway
      const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { success: false, error: "AI returned an unexpected format. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { config: parsed } });
  } catch (err) {
    console.error("[onboarding/ai-config]", err);
    return NextResponse.json(
      { success: false, error: "Failed to process markdown." },
      { status: 500 },
    );
  }
}
