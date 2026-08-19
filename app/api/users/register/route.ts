import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/users/register
 * Body: { email, password, displayName }
 * Creates a pending account. Admin must approve before user can log in.
 * Sends notification email to admin.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; displayName?: string; fullName?: string; age?: number; phone?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const { email, password, displayName, fullName, age, phone } = body;
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  if (!fullName?.trim()) return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  if (!age || age < 1 || age > 120) return NextResponse.json({ error: "Valid age is required." }, { status: 400 });
  if (!phone?.trim()) return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
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
    display_name: displayName?.trim() || fullName?.trim() || emailLower.split("@")[0],
    full_name: fullName?.trim() || "",
    age: age || null,
    phone: phone?.trim() || "",
    role: "user",
    status: "pending",
  });

  if (error) return NextResponse.json({ error: "Registration failed.", detail: error.message }, { status: 500 });

  // Send notification email to admin (non-blocking — don't fail registration if email fails)
  sendAdminNotification(emailLower, fullName?.trim() || "", age || 0, phone?.trim() || "").catch(
    (err) => console.error("[register] Email notification failed:", err)
  );

  return NextResponse.json({ ok: true, message: "Account created! Please wait for admin approval before signing in." });
}

async function sendAdminNotification(userEmail: string, fullName: string, age: number, phone: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[register] RESEND_API_KEY not set — skipping email notification.");
    return;
  }

  const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Pattern Speak Out <onboarding@resend.dev>",
      to: ["sweetpimja@gmail.com"],
      subject: `🆕 New Registration: ${fullName} (${userEmail})`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; max-width: 500px;">
          <h2 style="color: #ff2d55;">🆕 New User Registration</h2>
          <p>A new user has registered on Pattern Speak Out and is waiting for your approval.</p>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Full Name</td><td style="padding: 8px; border: 1px solid #ddd;">${fullName}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td><td style="padding: 8px; border: 1px solid #ddd;">${userEmail}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Age</td><td style="padding: 8px; border: 1px solid #ddd;">${age}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Phone</td><td style="padding: 8px; border: 1px solid #ddd;">${phone}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Status</td><td style="padding: 8px; border: 1px solid #ddd; color: #e67e22;">⏳ Pending Approval</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Registered</td><td style="padding: 8px; border: 1px solid #ddd;">${now}</td></tr>
          </table>
          <p>To approve this user:</p>
          <ol>
            <li>Go to <a href="https://patternspeakout-v2.vercel.app">patternspeakout-v2.vercel.app</a></li>
            <li>Sign in as admin (☰ button)</li>
            <li>Open 👥 Users tab</li>
            <li>Click ✅ Approve next to this user</li>
          </ol>
          <p style="color: #999; font-size: 12px;">— Pattern Speak Out System</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error: ${res.status} ${errText}`);
  }
}
