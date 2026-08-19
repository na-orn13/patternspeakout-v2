import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/users/login
 * Body: { email, password }
 * Returns user info + a session token (the user's UUID as token for simplicity).
 * Checks: password match, status=approved, not expired.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const { email, password } = body;
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

  const emailLower = email.trim().toLowerCase();
  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

  const { data: user, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("email", emailLower)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // Verify password
  const match = crypto.timingSafeEqual(
    Buffer.from(passwordHash, "hex"),
    Buffer.from(user.password_hash, "hex")
  );
  if (!match) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

  // Check status
  if (user.status === "pending") {
    return NextResponse.json({ error: "Your account is pending admin approval." }, { status: 403 });
  }
  if (user.status === "removed") {
    return NextResponse.json({ error: "Your account has been deactivated." }, { status: 403 });
  }

  // Check expiry
  if (user.expires_at && new Date(user.expires_at) < new Date()) {
    // Auto-remove expired accounts
    await supabase.from("app_users").update({ status: "removed" }).eq("id", user.id);
    return NextResponse.json({ error: "Your account has expired. Please contact admin." }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
    },
    token: user.id, // user UUID as session token
  });
}
