"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyCents } from "@/lib/currency";
import { expensesByCategory } from "@/lib/finance/overview";
import type { Period } from "@/lib/finance/calculations";
import { useFinance } from "@/lib/finance/finance-provider";

const MAX_ROWS = 6;

/** Para onde foi o dinheiro: despesas do período por categoria, em barras. */
export function ExpensesByCategory({ period, className }: { period: Period; className?: string }) {
  const { transactions, categories } = useFinance();
  const rows = expensesByCategory(transactions, period, categories);
  const shown = rows.slice(0, MAX_ROWS);
  const rest = rows.slice(MAX_ROWS).reduce((sum, r) => sum + r.amount, 0);
  const max = shown[0]?.amount ?? 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="font-display text-subheading">Para onde foi o dinheiro</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">
        {shown.length === 0 ? (
          <p className="text-body text-muted-foreground">Nenhuma despesa neste período.</p>
        ) : (
          shown.map((row) => (
            <div key={row.categoryId} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-body">
                <span className="truncate">{row.label}</span>
                <span className="shrink-0">
                  <span className="font-semibold">{formatCurrencyCents(row.amount)}</span>{" "}
                  <span className="text-muted-foreground">{Math.round(row.percent)}%</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-paper-mist">
                <div
                  className="h-2 rounded-full bg-linear-to-r from-brand-blue to-brand-aqua"
                  style={{ width: `${Math.max(3, (row.amount / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
        {rest > 0 ? <p className="text-caption text-muted-foreground">+ {formatCurrencyCents(rest)} em outras categorias</p> : null}
      </CardContent>
    </Card>
  );
}
