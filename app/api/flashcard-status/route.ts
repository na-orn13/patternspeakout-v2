import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/flashcard-status?userId=xxx — Get all flashcard statuses for a user
 * POST /api/flashcard-status — Update a single flashcard status
 *   Body: { userId, cardId, status: "memorised"|"not_memorised" }
 *
 * Uses the `flashcard_status` table:
 *   user_id (text), card_id (text), status (text), updated_at (timestamptz)
 *   Primary key: (user_id, card_id)
 *
 * If the table doesn't exist yet, we create it on first use via upsert.
 */

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required." }, { status: 400 });

  const { data, error } = await supabase
    .from("flashcard_status")
    .select("card_id, status, updated_at")
    .eq("user_id", userId);

  if (error) {
    // Table might not exist yet — return empty
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return NextResponse.json({ statuses: {} });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return as a map: { cardId: status }
  const statuses: Record<string, string> = {};
  for (const row of data ?? []) {
    statuses[row.card_id] = row.status;
  }

  return NextResponse.json({ statuses });
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; cardId?: string; status?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const { userId, cardId, status } = body;
  if (!userId || !cardId || !status) {
    return NextResponse.json({ error: "userId, cardId, and status required." }, { status: 400 });
  }

  if (status !== "memorised" && status !== "not_memorised") {
    return NextResponse.json({ error: "status must be 'memorised' or 'not_memorised'." }, { status: 400 });
  }

  const { error } = await supabase
    .from("flashcard_status")
    .upsert(
      { user_id: userId, card_id: cardId, status, updated_at: new Date().toISOString() },
      { onConflict: "user_id,card_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cardId, status });
}
