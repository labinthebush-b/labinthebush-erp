"use client";

import * as React from "react";
import { toast } from "sonner";
import type { CanvasElement, Point } from "./types";
import { canvasReducer, EMPTY_CANVAS_STATE, type CanvasAction, type CanvasState } from "./canvas-reducer";
import { useSupabaseReducer } from "@/lib/supabase/use-supabase-reducer";
import { useSupabaseUser } from "@/lib/supabase/use-supabase-user";
import { diffById } from "@/lib/supabase/diff-collection";
import { deleteCanvasElements, fetchCanvasElements, upsertCanvasElements } from "./repository";
import { uploadCanvasImage } from "./storage";
import { pushHistory, undoHistory, redoHistory, createImageElement, getNextZIndex, type HistoryStack } from "./calculations";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

async function fetchInitial(userId: string): Promise<CanvasState> {
  return { elements: await fetchCanvasElements(userId) };
}

async function sync(userId: string, previous: CanvasState, next: CanvasState): Promise<void> {
  const { inserted, updated, deletedIds } = diffById(previous.elements, next.elements);
  await Promise.all([upsertCanvasElements(userId, [...inserted, ...updated]), deleteCanvasElements(userId, deletedIds)]);
}

/** Measures an image file's natural size, capped to a sensible max width — the same sizing the old base64 path used. */
function measureImage(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxWidth = 420;
      const scale = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.naturalWidth * scale, height: img.naturalHeight * scale });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 240, height: 180 });
    };
    img.src = objectUrl;
  });
}

type CanvasContextValue = {
  elements: CanvasElement[];
  /** Adds one or more elements as a single undoable step. */
  addElements: (elements: CanvasElement[]) => void;
  /** Uploads an image to Storage and adds it as a canvas element — the only way an image ever gets a `src` (never base64 in the element itself). */
  addImage: (file: File, point: Point) => Promise<void>;
  /** Commits a change to one element (move/resize/edit) as a single undoable step. */
  updateElement: (id: string, changes: Partial<CanvasElement>) => void;
  /** Commits changes to several elements at once (e.g. multi-select drag) as one undoable step. */
  updateElements: (updates: { id: string; changes: Partial<CanvasElement> }[]) => void;
  deleteElements: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const CanvasContext = React.createContext<CanvasContextValue | null>(null);

export function CanvasProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useSupabaseReducer<CanvasState, CanvasAction>(
    canvasReducer,
    EMPTY_CANVAS_STATE,
    (hydratedState) => ({ type: "HYDRATE" as const, state: hydratedState }),
    fetchInitial,
    sync,
    // Atualizar em segundo plano moveria elementos no meio de um arraste.
    false
  );
  const { userId } = useSupabaseUser();

  // Undo/redo history lives only in memory (never persisted): it holds full
  // element-array snapshots, which would otherwise bloat storage with
  // duplicated data. Losing undo history on reload is an accepted trade-off
  // — see the Phase 4 report.
  const [history, setHistory] = React.useState<HistoryStack<CanvasElement[]>>({ past: [], future: [] });

  function commit(action: CanvasAction) {
    setHistory((h) => pushHistory(h, state.elements));
    dispatch(action);
  }

  const value = React.useMemo<CanvasContextValue>(
    () => ({
      elements: state.elements,

      addElements(elements) {
        commit({ type: "ADD_ELEMENTS", elements });
      },

      async addImage(file, point) {
        if (!userId) return;
        const elementId = makeId();
        try {
          const [{ width, height }, src] = await Promise.all([
            measureImage(file),
            uploadCanvasImage(userId, elementId, file),
          ]);
          const element = createImageElement(
            elementId,
            point.x - width / 2,
            point.y - height / 2,
            nowISO(),
            getNextZIndex(state.elements),
            src,
            width,
            height
          );
          commit({ type: "ADD_ELEMENTS", elements: [element] });
        } catch {
          toast.error("Não foi possível carregar essa imagem.");
        }
      },

      updateElement(id, changes) {
        commit({ type: "UPDATE_ELEMENT", id, changes });
      },

      updateElements(updates) {
        commit({ type: "UPDATE_ELEMENTS", updates });
      },

      deleteElements(ids) {
        commit({ type: "DELETE_ELEMENTS", ids });
      },

      undo() {
        const result = undoHistory(history, state.elements);
        if (!result) return;
        setHistory(result.stack);
        dispatch({ type: "HYDRATE", state: { elements: result.restored } });
      },

      redo() {
        const result = redoHistory(history, state.elements);
        if (!result) return;
        setHistory(result.stack);
        dispatch({ type: "HYDRATE", state: { elements: result.restored } });
      },

      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, history, dispatch, userId]
  );

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

export function useCanvas() {
  const ctx = React.useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvas must be used within a CanvasProvider");
  return ctx;
}
