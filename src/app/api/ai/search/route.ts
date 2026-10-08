// Harbor Web — AI search: natural-language movie/series discovery
// Runs entirely server-side (z-ai-web-dev-sdk). Returns title suggestions resolved to Metas client-side.
import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 500) : "";
    if (!query) {
      return NextResponse.json({ error: "missing query" }, { status: 400 });
    }

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content:
            'You are a movie and TV show recommendation engine inside a media center app. The user describes what they want to watch in natural language. Respond with ONLY a JSON array of 8-15 real movie or series titles (exact official titles, no years unless needed to disambiguate, no explanations). Example: ["Inception", "Breaking Bad", "Interstellar"]. Pick diverse, real, well-known titles that best match the request.',
        },
        { role: "user", content: query },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    // Extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ titles: [], error: "no suggestions" });
    }
    let titles: unknown;
    try {
      titles = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ titles: [], error: "parse error" });
    }
    if (!Array.isArray(titles)) {
      return NextResponse.json({ titles: [] });
    }
    const clean = titles
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length < 120)
      .slice(0, 15);
    return NextResponse.json({ titles: clean });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ai error";
    return NextResponse.json({ titles: [], error: msg }, { status: 500 });
  }
}
