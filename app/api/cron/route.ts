import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/cron
 * Called by Vercel Cron (configured in vercel.json).
 * Vercel passes the CRON_SECRET as a Bearer token automatically.
 * This just forwards to /api/sync with the admin secret.
 */
export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  const adminSecret = process.env.ADMIN_SECRET;

  if (!cronSecret || !adminSecret) {
    return NextResponse.json({ error: "Cron or admin secret not configured" }, { status: 500 });
  }

  // Verify this request is from Vercel Cron
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Call /api/sync internally
  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const syncUrl = `${protocol}://${host}/api/sync`;

  const res = await fetch(syncUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${adminSecret}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json();
  return NextResponse.json({ cron: true, syncResult: body }, { status: res.status });
}
