import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-only admin client using the service_role key -- bypasses RLS and
// can create pre-confirmed users directly. NEVER import this from client
// code or expose the key to the browser. Currently used for exactly one
// thing: creating a parent account without requiring them to confirm their
// own email (see src/app/api/auth/parent-signup/route.ts) -- students keep
// the normal supabase.auth.signUp() + confirm flow entirely unchanged,
// since their email confirmation is also their university verification and
// stays fully rigorous.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
