import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/auth
 * Body: { username: string; password: string }
 *
 * Validates against ADMIN_USERNAME + ADMIN_PASSWORD_HASH env vars.
 * Returns the ADMIN_SECRET on success so the client can use it
 * as a Bearer token for /api/sync and /api/sync/single.
 *
 * The password is compared as a SHA-256 hash to avoid timing attacks
 * and to avoid storing the plaintext password anywhere.
 */
export async function POST(req: NextRequest) {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminUsername || !adminPasswordHash || !adminSecret) {
    return NextResponse.json(
      { error: "Admin credentials not configured on server." },
      { status: 500 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json(
      { error: "username and password are required." },
      { status: 400 }
    );
  }

  const inputHash = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  const usernameMatch = username === adminUsername;
  const passwordMatch = crypto.timingSafeEqual(
    Buffer.from(inputHash, "hex"),
    Buffer.from(adminPasswordHash, "hex")
  );

  if (!usernameMatch || !passwordMatch) {
    // Uniform error — don't reveal which field was wrong
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  // Return the admin secret so the client can call /api/sync
  // This is safe: the secret is scoped to API calls, never embedded in code/git
  return NextResponse.json({ token: adminSecret });
}
