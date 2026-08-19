import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { summariseFromCaption } from "@/lib/summarise";
import { SEED_VIDEOS, type VideoRow } from "@/lib/seedData";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/sync
 *
 * Protected by ADMIN_SECRET env var.
 * Called by:
 *  - Admin "Sync Now" button  → Authorization: Bearer <ADMIN_SECRET>
 *  - Vercel Cron              → Authorization: Bearer <CRON_SECRET>  (same value)
 *
 * Phase 1 behaviour:
 *   - No TikTok token configured → upserts seed data from seedData.ts
 *   - TikTok token configured    → fetches real videos (Phase 2 placeholder)
 *
 * Deduplication: each row uses tiktok_id as the unique key (ON CONFLICT DO NOTHING
 * for core fields; stats columns are always updated).
 */
export async function POST(req: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────────────────
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json({ error: "ADMIN_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Start sync log entry ─────────────────────────────────────────────────
  const { data: logRow, error: logInsertErr } = await supabase
    .from("sync_log")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (logInsertErr || !logRow) {
    console.error("[sync] Could not create sync_log row:", logInsertErr?.message);
  }
  const logId = logRow?.id as string | undefined;

  const finishLog = async (status: "success" | "error", newVideos: number, errorMsg?: string) => {
    if (!logId) return;
    await supabase
      .from("sync_log")
      .update({ status, new_videos: newVideos, finished_at: new Date().toISOString(), error_msg: errorMsg ?? null })
      .eq("id", logId);
  };

  try {
    // ── Decide data source ───────────────────────────────────────────────
    const tiktokToken = process.env.TIKTOK_ACCESS_TOKEN;
    let candidates: VideoRow[];

    if (tiktokToken) {
      // Phase 2 placeholder — swap this for real TikTok API call
      candidates = await fetchFromTikTok(tiktokToken);
    } else {
      // Phase 1: use seed data
      console.log("[sync] No TIKTOK_ACCESS_TOKEN — using seed data.");
      candidates = SEED_VIDEOS;
    }

    // ── Check which tiktok_ids already exist ──────────────────────────────
    const ids = candidates.map((v) => v.tiktok_id);
    const { data: existing } = await supabase
      .from("videos")
      .select("tiktok_id")
      .in("tiktok_id", ids);

    const existingIds = new Set((existing ?? []).map((r: { tiktok_id: string }) => r.tiktok_id));
    const newCandidates = candidates.filter((v) => !existingIds.has(v.tiktok_id));

    // ── Generate summaries for new videos ────────────────────────────────
    const toInsert: VideoRow[] = [];

    for (const video of newCandidates) {
      if (!video.summary) {
        const result = await summariseFromCaption(video.caption, video.title);
        if (result) {
          video.summary = result.summary;
          video.summary_source = result.source;
        } else {
          // No OpenAI key or error — use caption directly, clearly labelled
          video.summary =
            `⚠️ Caption-based summary (AI unavailable):\n\n${video.caption}`;
          video.summary_source = "caption";
        }
      }
      toInsert.push(video);
    }

    // ── Upsert new videos ─────────────────────────────────────────────────
    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: upsertErr } = await supabase
        .from("videos")
        .upsert(toInsert, { onConflict: "tiktok_id", ignoreDuplicates: false });

      if (upsertErr) throw upsertErr;
      inserted = toInsert.length;
    }

    // ── Always update stats for ALL existing videos ───────────────────────
    // Also regenerate summaries for any that still have the fallback text
    const existingCandidates = candidates.filter((v) => existingIds.has(v.tiktok_id));

    // Fetch existing rows that still have fallback summaries so we can upgrade them
    const { data: staleRows } = await supabase
      .from("videos")
      .select("tiktok_id, caption, title, summary")
      .in("tiktok_id", existingCandidates.map((v) => v.tiktok_id))
      .like("summary", "⚠️ Caption-based summary (AI unavailable)%");

    let regenerated = 0;
    // Process in batches of 3 to stay within function timeout
    const BATCH = 3;
    const stale = staleRows ?? [];
    for (let i = 0; i < stale.length && i < BATCH; i++) {
      const row = stale[i];
      const result = await summariseFromCaption(row.caption, row.title);
      if (result) {
        await supabase
          .from("videos")
          .update({ summary: result.summary, summary_source: result.source, synced_at: new Date().toISOString() })
          .eq("tiktok_id", row.tiktok_id);
        regenerated++;
      }
    }
    const remaining = Math.max(0, stale.length - BATCH);

    for (const video of existingCandidates) {
      await supabase
        .from("videos")
        .update({
          view_count: video.view_count,
          like_count: video.like_count,
          comment_count: video.comment_count,
          share_count: video.share_count,
          synced_at: new Date().toISOString(),
        })
        .eq("tiktok_id", video.tiktok_id);
    }

    await finishLog("success", inserted);
    return NextResponse.json({
      ok: true,
      newVideos: inserted,
      updatedStats: existingCandidates.length,
      regeneratedSummaries: regenerated,
      remainingStale: remaining,
      source: tiktokToken ? "tiktok_api" : "seed",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync] Fatal error:", message);
    await finishLog("error", 0, message);

    // Surface rate-limit errors distinctly
    const status = message.toLowerCase().includes("rate") ? 429 : 500;
    return NextResponse.json({ error: "Sync failed", detail: message }, { status });
  }
}

// ── Phase 2 placeholder ──────────────────────────────────────────────────────
// Replace the body of this function with real TikTok Content API calls
// once your developer app is approved.
async function fetchFromTikTok(_token: string): Promise<VideoRow[]> {
  // TODO Phase 2:
  // POST https://open.tiktokapis.com/v2/video/list/
  // Headers: Authorization: Bearer <token>
  // Body: { "fields": ["id","title","video_description","cover_image_url","share_url",
  //         "duration","create_time","statistics"] }
  console.warn("[sync] fetchFromTikTok is a Phase 2 placeholder — returning seed data.");
  return SEED_VIDEOS;
}
