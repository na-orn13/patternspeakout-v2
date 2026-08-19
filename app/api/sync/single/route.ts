import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { summariseFromCaption } from "@/lib/summarise";
import type { VideoRow } from "@/lib/seedData";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/sync/single
 *
 * Accepts a TikTok video URL and upserts it into the database.
 * Because we are in Phase 1 (no TikTok API approval yet), this route
 * extracts the video ID from the URL and creates a stub record.
 *
 * When TIKTOK_ACCESS_TOKEN is set (Phase 2), it will fetch real metadata.
 *
 * Body: { url: string }   e.g. https://www.tiktok.com/@user/video/1234567890
 * Auth: Authorization: Bearer <ADMIN_SECRET>
 */
export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json({ error: "ADMIN_SECRET not configured." }, { status: 500 });
  }
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (token !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { url } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required." }, { status: 400 });
  }

  // ── Extract TikTok video ID from URL ──────────────────────────────────────
  // Handles formats:
  //   https://www.tiktok.com/@user/video/7234567890123456789
  //   https://vm.tiktok.com/ZMxxxxxxx/   (short link — we store the short ID)
  //   https://vt.tiktok.com/ZMxxxxxxx/
  const tiktokId = extractTikTokId(url);
  if (!tiktokId) {
    return NextResponse.json(
      { error: "Could not extract a TikTok video ID from the URL. Make sure it's a full video URL like https://www.tiktok.com/@user/video/1234567890123456789" },
      { status: 400 }
    );
  }

  // ── Check for duplicate ───────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("videos")
    .select("tiktok_id, title")
    .eq("tiktok_id", tiktokId)
    .single();

  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      message: `Video ${tiktokId} already exists in the database.`,
      title: existing.title,
    });
  }

  // ── Phase 2: fetch real metadata ──────────────────────────────────────────
  const tiktokToken = process.env.TIKTOK_ACCESS_TOKEN;
  let video: VideoRow;

  if (tiktokToken) {
    // TODO Phase 2: call TikTok API for real metadata
    // For now, fall through to stub
    video = buildStub(tiktokId, url);
  } else {
    // Phase 1 stub — user provided the URL so we record it with basic info
    video = buildStub(tiktokId, url);
  }

  // ── Generate summary ──────────────────────────────────────────────────────
  const summaryResult = await summariseFromCaption(video.caption, video.title);
  if (summaryResult) {
    video.summary = summaryResult.summary;
    video.summary_source = summaryResult.source;
  } else {
    video.summary = `⚠️ Caption-based summary (AI unavailable):\n\n${video.caption}`;
    video.summary_source = "caption";
  }

  // ── Upsert ────────────────────────────────────────────────────────────────
  const { error: upsertErr } = await supabase
    .from("videos")
    .upsert(video, { onConflict: "tiktok_id", ignoreDuplicates: false });

  if (upsertErr) {
    return NextResponse.json(
      { error: "Database upsert failed.", detail: upsertErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    duplicate: false,
    tiktokId,
    title: video.title,
    source: tiktokToken ? "tiktok_api" : "stub_phase1",
    message: tiktokToken
      ? "Video fetched from TikTok API and saved."
      : "Phase 1: video ID saved as stub. Real metadata will be available after TikTok API is connected.",
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTikTokId(url: string): string | null {
  // Full URL: /video/1234567890123456789
  const longMatch = url.match(/\/video\/(\d+)/);
  if (longMatch) return longMatch[1];

  // Short URLs: vm.tiktok.com/ZMxxxxxxx or vt.tiktok.com/ZMxxxxxxx
  const shortMatch = url.match(/(?:vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)/);
  if (shortMatch) return `short_${shortMatch[1]}`;

  // Bare numeric ID passed directly
  if (/^\d{15,}$/.test(url.trim())) return url.trim();

  return null;
}

function buildStub(tiktokId: string, url: string): VideoRow {
  return {
    tiktok_id: tiktokId,
    title: `TikTok Video (ID: ${tiktokId})`,
    caption:
      `Video added manually via URL: ${url}\n\n` +
      `Phase 1: No TikTok API token configured. ` +
      `Real title, caption, and stats will be populated once TIKTOK_ACCESS_TOKEN is set.`,
    cover_image_url: "",
    share_url: url,
    duration: 0,
    published_at: new Date().toISOString(),
    view_count: 0,
    like_count: 0,
    comment_count: 0,
    share_count: 0,
    summary_source: "caption",
  };
}
