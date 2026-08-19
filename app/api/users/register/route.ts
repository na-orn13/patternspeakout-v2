import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/users/register
 * Body: { email, password, displayName }
 * Creates a pending account. Admin must approve before user can log in.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; displayName?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const { email, password, displayName } = body;
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });

  const emailLower = email.trim().toLowerCase();
  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

  // Check if email already exists
  const { data: existing } = await supabase
    .from("app_users")
    .select("id, status")
    .eq("email", emailLower)
    .single();

  if (existing) {
    return NextResponse.json({ error: "This email is already registered." }, { status: 409 });
  }

  const { error } = await supabase.from("app_users").insert({
    email: emailLower,
    password_hash: passwordHash,
    display_name: displayName?.trim() || emailLower.split("@")[0],
    role: "user",
    status: "pending",
  });

  if (error) return NextResponse.json({ error: "Registration failed.", detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "Account created! Please wait for admin approval before signing in." });
}
