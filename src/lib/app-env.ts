// Which environment this build is running as — DEV or PROD — for the one
// thing the codebase itself must never be ambiguous about: whether it's
// touching real customer/financial data.
//
// Deliberately its own explicit variable (not Vercel's automatic VERCEL_ENV/
// NEXT_PUBLIC_VERCEL_ENV), set per-environment in Vercel's dashboard
// (Production=1, Preview/Development=unset) and in .env.local for local
// work — see ENVIRONMENTS.md. A dedicated var means this never depends on
// how a given deployment happened to be triggered, and reads the same way
// as every other NEXT_PUBLIC_* getter in this codebase (see
// lib/supabase/env.ts): a literal `process.env.NEXT_PUBLIC_X` reference so
// Next.js can actually inline it into the client bundle.
export type AppEnv = "production" | "development";

export function getAppEnv(): AppEnv {
  return process.env.NEXT_PUBLIC_APP_ENV === "production" ? "production" : "development";
}

export function isProductionEnv(): boolean {
  return getAppEnv() === "production";
}
