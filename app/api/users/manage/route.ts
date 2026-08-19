import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/users/manage — List all users (admin only)
 * POST /api/users/manage — Update user status/expiry (admin only)
 *   Body: { userId, action, expiresAt? }
 *   action: "approve" | "remove" | "set_expiry"
 */

function isAdmin(req: NextRequest): boolean {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  return token === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, display_name, role, status, expires_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: { userId?: string; action?: string; expiresAt?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const { userId, action, expiresAt } = body;
  if (!userId || !action) return NextResponse.json({ error: "userId and action required." }, { status: 400 });

  switch (action) {
    case "approve": {
      const { error } = await supabase.from("app_users").update({ status: "approved" }).eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "User approved." });
    }
    case "remove": {
      const { error } = await supabase.from("app_users").update({ status: "removed" }).eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "User removed." });
    }
    case "set_expiry": {
      const { error } = await supabase.from("app_users").update({ expires_at: expiresAt ?? null }).eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: expiresAt ? `Expiry set to ${expiresAt}.` : "Expiry removed." });
    }
    case "delete": {
      const { error } = await supabase.from("app_users").delete().eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "User permanently deleted." });
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
