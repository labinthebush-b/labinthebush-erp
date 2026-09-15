// Fails loudly and early if the required Supabase environment variables are
// missing, instead of letting `createClient` throw a cryptic error deep
// inside some component. See .env.local.example for what to set.
//
// IMPORTANT: each NEXT_PUBLIC_* reference below must be written as a literal
// `process.env.NEXT_PUBLIC_X` at its own call site. Next.js inlines
// NEXT_PUBLIC_* values into the client bundle by statically matching that
// exact textual pattern at build time — routing it through a shared helper
// that does `process.env[name]` (a dynamic lookup) defeats that: the code
// still works server-side (where `process.env` is the real environment) but
// silently resolves to `undefined` in the browser, since Next.js never saw
// a literal pattern there to replace. Don't "clean this up" into one
// generic function again — that's the exact bug this fixes.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Copie .env.local.example para .env.local e preencha com os dados do seu projeto Supabase.`
    );
  }
  return value;
}

export function getSupabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Service-role key — server-only, never exposed to the browser. Used by the dev seed script and by the AI integration route (src/lib/ai), which must resolve an API key to a user before any Supabase session/JWT exists. */
export function getSupabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}
