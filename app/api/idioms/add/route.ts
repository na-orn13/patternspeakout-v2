import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/idioms/add
 *
 * Admin-only endpoint. Accepts a structured idiom JSON object and upserts it
 * into the videos table. The full structured data is stored as JSON in the
 * `summary` column with `summary_source = 'structured'`.
 *
 * The frontend detects `summary_source === 'structured'` and renders the
 * rich detail modal (CEFR, key words, synonyms, antonyms, examples, etc.).
 *
 * Body: structured idiom object matching the IdiomData interface.
 * Auth: Authorization: Bearer <ADMIN_SECRET>
 */

export interface KeyWord {
  word: string;
  cefr: string;
  pos: string;
  definitionEN: string;
  definitionTH: string;
  synonyms: string[];
  antonyms: string[];
}

export interface Example {
  en: string;
  th: string;
}

export interface IdiomData {
  idiom: string;
  cefr: string;
  partOfSpeech: string;
  episode?: string;
  date?: string;
  thumbnail?: string;
  color?: string;
  tiktokUrl?: string;
  definitionEN: string;
  definitionTH: string;
  synonyms: string[];
  antonyms: string[];
  keyWords: KeyWord[];
  examples: Example[];
  usage: string;
  context: string;
}

export async function POST(req: NextRequest) {
  // Auth
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json({ error: "ADMIN_SECRET not configured." }, { status: 500 });
  }
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (token !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Parse body
  let body: IdiomData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Validate required fields
  if (!body.idiom || !body.definitionEN || !body.definitionTH) {
    return NextResponse.json(
      { error: "Missing required fields: idiom, definitionEN, definitionTH" },
      { status: 400 }
    );
  }

  // Generate a stable tiktok_id from the idiom name if not linked to a real video
  const idiomSlug = body.idiom.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const tiktokId = body.tiktokUrl
    ? extractVideoId(body.tiktokUrl) ?? `idiom_${idiomSlug}`
    : `idiom_${idiomSlug}`;

  // Build the row
  const row = {
    tiktok_id: tiktokId,
    title: `Idiom of the Day: ${body.idiom}`,
    caption: `${body.thumbnail ?? "📚"} ${body.idiom} — ${body.definitionEN}`,
    cover_image_url: "",
    share_url: body.tiktokUrl ?? "https://www.tiktok.com/@patternspeakout",
    duration: 0,
    published_at: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
    view_count: 0,
    like_count: 0,
    comment_count: 0,
    share_count: 0,
    summary: JSON.stringify(body),
    summary_source: "structured",
    synced_at: new Date().toISOString(),
  };

  // Upsert (update if same tiktok_id exists)
  const { error: upsertErr } = await supabase
    .from("videos")
    .upsert(row, { onConflict: "tiktok_id", ignoreDuplicates: false });

  if (upsertErr) {
    return NextResponse.json(
      { error: "Database error.", detail: upsertErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    tiktokId,
    idiom: body.idiom,
    message: `"${body.idiom}" saved successfully.`,
  });
}

function extractVideoId(url: string): string | null {
  const longMatch = url.match(/\/video\/(\d+)/);
  if (longMatch) return longMatch[1];
  const shortMatch = url.match(/(?:vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)/);
  if (shortMatch) return `short_${shortMatch[1]}`;
  return null;
}
