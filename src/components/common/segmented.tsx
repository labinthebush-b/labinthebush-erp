"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: string };

/**
 * Seletor em pílulas (Tudo / Ano / Mês, Entradas / Saídas...). `variant`
 * "track" = pílulas dentro de uma trilha branca (seletor de período);
 * "chips" = pílulas soltas com contorno (filtros de gráfico e lista).
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  variant = "track",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** Nome do grupo para leitores de tela. */
  label: string;
  variant?: "track" | "chips";
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex flex-wrap items-center gap-1",
        variant === "track" && "rounded-full border border-border bg-card p-1",
        variant === "chips" && "gap-1.5",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 rounded-full px-4 text-body font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              variant === "track" && (active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"),
              variant === "chips" &&
                (active ? "border border-primary bg-primary text-primary-foreground" : "border border-smoke bg-card text-foreground hover:bg-paper-mist")
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
