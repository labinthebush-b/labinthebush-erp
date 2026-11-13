"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/lib/nav";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Menu lateral só de ícones (redesign 2026-11): um trilho flutuante e
 * arredondado, com o nome de cada página no tooltip. Os grupos do menu
 * viram pequenos espaços entre os ícones. No celular o menu continua no
 * Sheet do Header.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={150}>
      <aside className="hidden shrink-0 p-3 pr-0 md:flex">
        <nav
          aria-label="Menu principal"
          className="flex w-[72px] flex-col items-center gap-1 overflow-y-auto rounded-[28px] border border-border bg-card py-4"
        >
          <Link
            href="/"
            aria-label="Lab in the Bush — início"
            className="brand-gradient brand-gradient-animated mb-3 flex size-11 shrink-0 items-center justify-center rounded-2xl"
          >
            <span className="font-display text-body font-semibold text-foreground">LB</span>
          </Link>

          {NAV_GROUPS.map((group, index) => (
            <div key={group.label ?? index} className={cn("flex flex-col items-center gap-1", index > 0 && "mt-2 border-t border-border pt-2")}>
              {group.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        aria-label={item.title}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors",
                          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                        )}
                      >
                        <item.icon className="size-[19px]" strokeWidth={1.8} />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.title}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
