"use client";

import { Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { QuickActionButton } from "@/components/layout/quick-action-button";
import { UserMenu } from "@/components/layout/user-menu";
import { useUI } from "@/components/providers/ui-provider";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import * as React from "react";

function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>ERP da Marca</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-0.5 p-2">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2 py-2 text-body",
                  active ? "bg-sidebar-accent font-medium" : "hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="size-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
        <Menu className="size-4" />
      </Button>
    </Sheet>
  );
}

export function Header() {
  const { setCommandPaletteOpen } = useUI();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <MobileNav />
      <Breadcrumbs />
      <EnvironmentBadge />

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          className="hidden h-8 gap-2 text-muted-foreground sm:flex"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="size-3.5" />
          Buscar
          <kbd className="ml-2 rounded border border-border bg-paper-mist px-1.5 py-0.5 text-[10px] font-medium">
            Ctrl K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Buscar"
        >
          <Search className="size-4" />
        </Button>

        <NotificationsMenu />
        <QuickActionButton />
        <UserMenu />
      </div>
    </header>
  );
}
