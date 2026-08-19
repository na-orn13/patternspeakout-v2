import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/favourites?userId=xxx — Get user's favourites (idioms + words)
 * POST /api/favourites — Add/remove a favourite
 *   Body for idiom: { userId, tiktokId, action: "add"|"remove", itemType: "idiom" }
 *   Body for word:  { userId, tiktokId, action: "add"|"remove", itemType: "word", wordData: {...} }
 *   tiktokId for words = "word_<word>" (unique key per word)
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
    .select("tiktok_id, item_type, word_data, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const idioms = (data ?? []).filter(f => f.item_type === "idiom").map(f => f.tiktok_id);
  const words = (data ?? []).filter(f => f.item_type === "word").map(f => ({
    id: f.tiktok_id,
    data: f.word_data,
    createdAt: f.created_at,
  }));

  return NextResponse.json({ favourites: idioms, words });
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; tiktokId?: string; action?: string; itemType?: string; wordData?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const { userId, tiktokId, action, itemType = "idiom", wordData } = body;
  if (!userId || !tiktokId || !action) {
    return NextResponse.json({ error: "userId, tiktokId, and action required." }, { status: 400 });
  }

  // Verify user
  const { data: user } = await supabase.from("app_users").select("id, status").eq("id", userId).single();
  if (!user || user.status !== "approved") {
    return NextResponse.json({ error: "Invalid or unapproved user." }, { status: 401 });
  }

  if (action === "add") {
    const row: Record<string, unknown> = {
      user_id: userId,
      tiktok_id: tiktokId,
      item_type: itemType,
    };
    if (itemType === "word" && wordData) {
      row.word_data = wordData;
    }

    const { error } = await supabase.from("favourites").upsert(
      row,
      { onConflict: "user_id,tiktok_id,item_type", ignoreDuplicates: true }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: "added" });
  }

  if (action === "remove") {
    const { error } = await supabase.from("favourites")
      .delete()
      .eq("user_id", userId)
      .eq("tiktok_id", tiktokId)
      .eq("item_type", itemType);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: "removed" });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
