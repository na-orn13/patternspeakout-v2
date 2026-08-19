import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/favourites?userId=xxx — Get user's favourites
 * POST /api/favourites — Add/remove a favourite
 *   Body: { userId, tiktokId, action: "add" | "remove" }
 */

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required." }, { status: 400 });

  // Verify user exists and is approved
  const { data: user } = await supabase.from("app_users").select("id, status").eq("id", userId).single();
  if (!user || user.status !== "approved") {
    return NextResponse.json({ error: "Invalid user." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("favourites")
    .select("tiktok_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favourites: (data ?? []).map(f => f.tiktok_id) });
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; tiktokId?: string; action?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const { userId, tiktokId, action } = body;
  if (!userId || !tiktokId || !action) {
    return NextResponse.json({ error: "userId, tiktokId, and action required." }, { status: 400 });
  }

  // Verify user
  const { data: user } = await supabase.from("app_users").select("id, status").eq("id", userId).single();
  if (!user || user.status !== "approved") {
    return NextResponse.json({ error: "Invalid or unapproved user." }, { status: 401 });
  }

  if (action === "add") {
    const { error } = await supabase.from("favourites").upsert(
      { user_id: userId, tiktok_id: tiktokId },
      { onConflict: "user_id,tiktok_id", ignoreDuplicates: true }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: "added" });
  }

  if (action === "remove") {
    const { error } = await supabase.from("favourites")
      .delete()
      .eq("user_id", userId)
      .eq("tiktok_id", tiktokId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: "removed" });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
