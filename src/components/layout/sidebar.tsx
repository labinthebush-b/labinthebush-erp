"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- ícone local já otimizado */}
        <img src="/icons/icon-192.png" alt="" className="size-7 rounded-lg" />
        <span className="font-display text-body-lg text-sidebar-foreground">
          Lab in the Bush
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-2">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label ?? index} className="flex flex-col gap-0.5">
            {group.label ? (
              <span className="px-2 pb-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </span>
            ) : null}
            {group.items.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-2 text-body text-sidebar-foreground transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/50"
                  )}
                >
                  <item.icon className="size-4 shrink-0" strokeWidth={2} />
                  {item.title}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3 text-caption text-muted-foreground">
        Lab in the Bush · ERP
      </div>
    </aside>
  );
}
