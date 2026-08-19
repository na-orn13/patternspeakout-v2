import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/idioms/delete
 * Body: { tiktokId: string }
 * Auth: Authorization: Bearer <ADMIN_SECRET>
 */
export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return NextResponse.json({ error: "Not configured." }, { status: 500 });

  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (token !== adminSecret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: { tiktokId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  if (!body.tiktokId) return NextResponse.json({ error: "tiktokId is required." }, { status: 400 });

  const { data, error } = await supabase
    .from("videos")
    .delete()
    .eq("tiktok_id", body.tiktokId)
    .select("tiktok_id, title")
    .single();

  if (error) return NextResponse.json({ error: "Delete failed.", detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: data?.title ?? body.tiktokId });
}
