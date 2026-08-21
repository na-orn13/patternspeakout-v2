import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/users/settings
 * Body: { userId, displayName?, currentPassword?, newPassword? }
 * Updates display name and/or password for the authenticated user.
 */
export async function POST(req: NextRequest) {
  let body: { userId?: string; displayName?: string; currentPassword?: string; newPassword?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const { userId, displayName, currentPassword, newPassword } = body;
  if (!userId) return NextResponse.json({ error: "User ID is required." }, { status: 400 });

  // Fetch user to verify existence
  const { data: user, error } = await supabase
    .from("app_users")
    .select("id, password_hash, display_name")
    .eq("id", userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const updates: Record<string, string> = {};

  // Handle display name change
  if (displayName && displayName.trim()) {
    const trimmed = displayName.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      return NextResponse.json({ error: "Display name must be 1-100 characters." }, { status: 400 });
    }
    updates.display_name = trimmed;
  }

  // Handle password change
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required to set a new password." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
    }

    // Verify current password
    const currentHash = crypto.createHash("sha256").update(currentPassword).digest("hex");
    const match = crypto.timingSafeEqual(
      Buffer.from(currentHash, "hex"),
      Buffer.from(user.password_hash, "hex")
    );
    if (!match) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    // Hash new password
    updates.password_hash = crypto.createHash("sha256").update(newPassword).digest("hex");
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  // Apply updates
  const { error: updateError } = await supabase
    .from("app_users")
    .update(updates)
    .eq("id", userId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    displayName: updates.display_name || user.display_name,
  });
}
