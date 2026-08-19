import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/analytics — Log an event (public, no auth required)
 * Body: { eventType, eventData?, userId?, sessionId? }
 *
 * Event types:
 *   - page_view: user visited the site
 *   - card_click: user opened an episode detail
 *   - favourite_add: user saved an idiom/word
 *   - favourite_remove: user removed from deck
 *   - deck_view: user opened the deck page
 *   - flashcard_start: user started flashcard mode
 *
 * GET /api/analytics — Get stats summary (admin only)
 */

export async function POST(req: NextRequest) {
  let body: { eventType?: string; eventData?: Record<string, unknown>; userId?: string; sessionId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const { eventType, eventData, userId, sessionId } = body;
  if (!eventType) return NextResponse.json({ error: "eventType required." }, { status: 400 });

  // Fire and forget — don't block the response
  supabase.from("analytics_events").insert({
    event_type: eventType,
    event_data: eventData ?? {},
    user_id: userId || null,
    session_id: sessionId || null,
  }).then(({ error }) => {
    if (error) console.error("[analytics] Insert error:", error.message);
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  // Admin only
  const adminSecret = process.env.ADMIN_SECRET;
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!adminSecret || token !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Total page views (all time, this week, today)
  const [allViews, weekViews, todayViews] = await Promise.all([
    supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_type", "page_view"),
    supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_type", "page_view").gte("created_at", weekAgo),
    supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_type", "page_view").gte("created_at", today),
  ]);

  // Card clicks (which episodes are most opened)
  const { data: clicksRaw } = await supabase
    .from("analytics_events")
    .select("event_data")
    .eq("event_type", "card_click")
    .gte("created_at", monthAgo);

  const clickCounts: Record<string, { title: string; count: number }> = {};
  for (const row of clicksRaw ?? []) {
    const d = row.event_data as { tiktokId?: string; title?: string } | null;
    if (d?.tiktokId) {
      if (!clickCounts[d.tiktokId]) clickCounts[d.tiktokId] = { title: d.title ?? d.tiktokId, count: 0 };
      clickCounts[d.tiktokId].count++;
    }
  }
  const topEpisodes = Object.entries(clickCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([id, v]) => ({ id, title: v.title, clicks: v.count }));

  // Favourite events (most saved)
  const { data: favRaw } = await supabase
    .from("analytics_events")
    .select("event_data")
    .eq("event_type", "favourite_add")
    .gte("created_at", monthAgo);

  const favCounts: Record<string, { name: string; count: number }> = {};
  for (const row of favRaw ?? []) {
    const d = row.event_data as { tiktokId?: string; word?: string; title?: string } | null;
    const key = d?.word ?? d?.tiktokId ?? "unknown";
    const name = d?.word ?? d?.title ?? key;
    if (!favCounts[key]) favCounts[key] = { name, count: 0 };
    favCounts[key].count++;
  }
  const topFavourites = Object.entries(favCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([id, v]) => ({ id, name: v.name, saves: v.count }));

  // Active users (unique user_ids this week)
  const { data: activeRaw } = await supabase
    .from("analytics_events")
    .select("user_id")
    .gte("created_at", weekAgo)
    .not("user_id", "is", null);

  const uniqueUsers = new Set((activeRaw ?? []).map(r => r.user_id).filter(Boolean));

  // Total events count
  const { count: totalEvents } = await supabase
    .from("analytics_events")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    pageViews: {
      total: allViews.count ?? 0,
      thisWeek: weekViews.count ?? 0,
      today: todayViews.count ?? 0,
    },
    topEpisodes,
    topFavourites,
    activeUsersThisWeek: uniqueUsers.size,
    totalEvents: totalEvents ?? 0,
  });
}
