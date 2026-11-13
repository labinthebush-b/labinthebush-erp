"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Field } from "@/components/common/field";
import { Combobox } from "@/components/common/combobox";
import { CurrencyInput } from "@/components/common/currency-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyCents } from "@/lib/currency";
import { calculateResultado } from "@/lib/finance/calculations";
import { monthBounds } from "@/lib/finance/period";
import { useFinance } from "@/lib/finance/finance-provider";
import { usePlanning } from "@/lib/planning/planning-provider";
import { buildBudgetProgress, buildCategoryDistribution } from "@/lib/planning/calculations";
import type { BudgetKind } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/** Seção 7 — orçamento só como referência: planejado × realizado, nunca uma regra que bloqueia algo. */
export function PlanningBudgets({ monthId }: { monthId: string }) {
  const { transactions, categories } = useFinance();
  const { budgets, setBudget, removeBudget } = usePlanning();

  const [categoryId, setCategoryId] = React.useState("");
  const [kind, setKind] = React.useState<BudgetKind>("valor");
  const [value, setValue] = React.useState(0);
  const [percent, setPercent] = React.useState(15);

  const range = monthBounds(monthId);
  const resultado = calculateResultado(transactions, range, categories);
  const distribution = buildCategoryDistribution(transactions, categories, range);
  const despesaCategories = categories.filter((c) => c.group === "custo" || c.group === "despesa");
  // Só metas de custo/despesa aqui; a meta de receita de vendas fica na tela de Vendas.
  const expenseBudgets = budgets.filter((b) => despesaCategories.some((c) => c.id === b.categoryId));
  const progress = buildBudgetProgress(expenseBudgets, distribution, categories, resultado.receita);
  const availableCategories = despesaCategories.filter((c) => !budgets.some((b) => b.categoryId === c.id));

  function handleAdd() {
    if (!categoryId) {
      toast.error("Selecione uma categoria.");
      return;
    }
    const amount = kind === "valor" ? value : percent;
    if (amount <= 0) {
      toast.error("Informe um valor de meta maior que zero.");
      return;
    }
    setBudget(categoryId, kind, amount);
    toast.success("Meta salva.");
    setCategoryId("");
    setValue(0);
    setPercent(15);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planejamento por categoria</CardTitle>
        <CardDescription>Metas são uma referência opcional — não bloqueiam nem alteram nenhum lançamento.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {progress.length === 0 ? (
          <p className="text-body text-muted-foreground">Nenhuma meta definida ainda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {progress.map((p) => (
              <div key={p.categoryId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-col">
                  <span className="text-body text-foreground">{p.label}</span>
                  <span className="text-caption text-muted-foreground">
                    Planejado {formatCurrencyCents(p.plannedAmount)} · Realizado {formatCurrencyCents(p.realizedAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-body font-medium", p.differenceAmount < 0 ? "text-destructive" : "text-vivid-green")}>
                    {p.differenceAmount < 0 ? "Estourou em " : "Dentro, sobram "}
                    {formatCurrencyCents(Math.abs(p.differenceAmount))}
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label="Remover meta" onClick={() => removeBudget(p.categoryId)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <Field label="Categoria" className="min-w-40 flex-1">
            <Combobox
              options={availableCategories.map((c) => ({ value: c.id, label: c.label }))}
              value={categoryId}
              onValueChange={setCategoryId}
              placeholder="Selecionar categoria"
            />
          </Field>
          <Field label="Tipo de meta">
            <Select value={kind} onValueChange={(v) => setKind(v as BudgetKind)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="valor">Valor fixo</SelectItem>
                <SelectItem value="percentual">% da receita</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {kind === "valor" ? (
            <Field label="Meta mensal">
              <CurrencyInput value={value} onValueChange={setValue} className="w-32" />
            </Field>
          ) : (
            <Field label="Meta (%)">
              <div className="flex w-24 items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={percent}
                  onChange={(e) => setPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                />
                <span className="text-body text-muted-foreground">%</span>
              </div>
            </Field>
          )}
          <Button onClick={handleAdd}>
            <Plus className="size-4" />
            Adicionar meta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
