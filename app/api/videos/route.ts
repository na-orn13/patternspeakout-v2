import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
// Allow CDN caching for 60 s; stale-while-revalidate for 120 s
export const revalidate = 60;

export async function GET() {
  try {
    // Fetch videos newest-first
    const { data: videos, error: videosError } = await supabase
      .from("videos")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(100);

    if (videosError) throw videosError;

    // Fetch the most recent successful sync timestamp
    const { data: syncRows, error: syncError } = await supabase
      .from("sync_log")
      .select("finished_at, status, new_videos")
      .eq("status", "success")
      .order("finished_at", { ascending: false })
      .limit(1);

    if (syncError) console.warn("[api/videos] sync_log query error:", syncError.message);

    const lastSync = syncRows?.[0]?.finished_at ?? null;

    return NextResponse.json(
      { videos: videos ?? [], lastSync },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/videos] Error:", message);
    return NextResponse.json(
      { error: "Failed to fetch videos", detail: message },
      { status: 500 }
    );
  }
}
