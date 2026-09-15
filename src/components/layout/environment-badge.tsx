import { Tag } from "@/components/common/tag";
import { isProductionEnv } from "@/lib/app-env";

/**
 * Only ever renders in a non-production build — production's absence of
 * this badge IS the signal (documented in ENVIRONMENTS.md), so it never
 * competes visually with the real app. Shows in local dev and in every
 * Vercel Preview deployment (the `dev` branch), never on the production
 * deployment (main).
 */
export function EnvironmentBadge() {
  if (isProductionEnv()) return null;
  return (
    <Tag color="orange" className="border border-[#f59e0b]/40 font-semibold uppercase tracking-wide">
      DEV — dados de teste
    </Tag>
  );
}
