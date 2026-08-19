import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/idioms/edit
 * Body: { tiktokId: string, data: IdiomData }
 * Auth: Authorization: Bearer <ADMIN_SECRET>
 *
 * Overwrites the structured JSON for an existing episode.
 */
export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return NextResponse.json({ error: "Not configured." }, { status: 500 });

  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (token !== adminSecret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: { tiktokId?: string; data?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  if (!body.tiktokId || !body.data) {
    return NextResponse.json({ error: "tiktokId and data are required." }, { status: 400 });
  }

  const idiomData = body.data as { idiom?: string; definitionEN?: string; date?: string; thumbnail?: string };
  if (!idiomData.idiom || !idiomData.definitionEN) {
    return NextResponse.json({ error: "data must have at least idiom and definitionEN." }, { status: 400 });
  }

  const updateFields: Record<string, unknown> = {
    title: `Idiom of the Day: ${idiomData.idiom}`,
    caption: `${idiomData.thumbnail ?? "📚"} ${idiomData.idiom} — ${idiomData.definitionEN}`,
    summary: JSON.stringify(body.data),
    summary_source: "manual",
    synced_at: new Date().toISOString(),
  };

  // Allow updating published_at if date changed
  if (idiomData.date) {
    updateFields.published_at = new Date(idiomData.date).toISOString();
  }

  const { error } = await supabase
    .from("videos")
    .update(updateFields)
    .eq("tiktok_id", body.tiktokId);

  if (error) return NextResponse.json({ error: "Update failed.", detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, idiom: idiomData.idiom, message: `"${idiomData.idiom}" updated.` });
}
