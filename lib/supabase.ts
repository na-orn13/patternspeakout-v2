import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton — created on first call, not at import time.
// This allows the Next.js build to complete even when env vars are not set
// at build time (they will be present at runtime on Vercel).
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
        "Set them in Vercel → Project → Settings → Environment Variables."
    );
  }

  _client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
  return _client;
}

// Convenience re-export so existing imports of `supabase` still compile,
// but access is deferred to runtime.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
