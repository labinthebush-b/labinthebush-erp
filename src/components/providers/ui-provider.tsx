"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { CommandPalette } from "@/components/layout/command-palette";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { cn } from "@/lib/utils";

export type DrawerConfig = {
  title: string;
  description?: string;
  content: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "left";
  /** Tailwind max-width override for the drawer panel, e.g. "sm:max-w-lg". */
  widthClassName?: string;
};

export type ModalConfig = {
  title: string;
  description?: string;
  content: React.ReactNode;
  footer?: React.ReactNode;
  /** Tailwind max-width override for the dialog panel, e.g. "sm:max-w-lg". */
  widthClassName?: string;
};

export type Notification = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  /** Where clicking this notification should take the user, when relevant. */
  href?: string;
};

export type ConfirmConfig = {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

type UIContextValue = {
  openDrawer: (config: DrawerConfig) => void;
  closeDrawer: () => void;
  openModal: (config: ModalConfig) => void;
  closeModal: () => void;
  /** Opens a shared confirmation dialog for destructive actions (delete, etc). */
  confirm: (config: ConfirmConfig) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  notifications: Notification[];
  markAllNotificationsRead: () => void;
};

const UIContext = React.createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = React.useState<DrawerConfig | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [modal, setModal] = React.useState<ModalConfig | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [confirmConfig, setConfirmConfig] = React.useState<ConfirmConfig | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  // Só avisos pontuais emitidos pela própria interface entram aqui. Os avisos de
  // negócio (contas, estoque, margem, tarefas) são derivados ao vivo dos dados
  // — ver NotificationsMenu. Nunca semear com exemplos: já apareceram
  // "Pedido #1042 pago" e "Estoque baixo" inventados para o usuário real.
  const [notifications, setNotifications] = React.useState<Notification[]>([]);

  const openDrawer = React.useCallback((config: DrawerConfig) => {
    setDrawer(config);
    setDrawerOpen(true);
  }, []);
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

  const openModal = React.useCallback((config: ModalConfig) => {
    setModal(config);
    setModalOpen(true);
  }, []);
  const closeModal = React.useCallback(() => setModalOpen(false), []);

  const confirm = React.useCallback((config: ConfirmConfig) => {
    setConfirmConfig(config);
    setConfirmOpen(true);
  }, []);

  const markAllNotificationsRead = React.useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value = React.useMemo<UIContextValue>(
    () => ({
      openDrawer,
      closeDrawer,
      openModal,
      closeModal,
      confirm,
      commandPaletteOpen,
      setCommandPaletteOpen,
      notifications,
      markAllNotificationsRead,
    }),
    [openDrawer, closeDrawer, openModal, closeModal, confirm, commandPaletteOpen, notifications, markAllNotificationsRead]
  );

  return (
    <UIContext.Provider value={value}>
      {children}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side={drawer?.side ?? "right"}
          className={drawer?.widthClassName ?? "sm:max-w-md"}
        >
          <SheetHeader>
            <SheetTitle>{drawer?.title}</SheetTitle>
            {drawer?.description ? (
              <SheetDescription>{drawer.description}</SheetDescription>
            ) : null}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4">{drawer?.content}</div>
          {drawer?.footer ? <SheetFooter>{drawer.footer}</SheetFooter> : null}
        </SheetContent>
      </Sheet>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className={cn("max-h-[85vh] overflow-y-auto", modal?.widthClassName ?? "sm:max-w-md")}>
          <DialogHeader>
            <DialogTitle>{modal?.title}</DialogTitle>
            {modal?.description ? (
              <DialogDescription>{modal.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          {modal?.content}
          {modal?.footer ? <DialogFooter>{modal.footer}</DialogFooter> : null}
        </DialogContent>
      </Dialog>

      {confirmConfig ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmConfig.title}
          description={confirmConfig.description}
          confirmLabel={confirmConfig.confirmLabel}
          onConfirm={confirmConfig.onConfirm}
        />
      ) : null}

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = React.useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within a UIProvider");
  return ctx;
}
