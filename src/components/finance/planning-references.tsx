"use client";

import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Tag } from "@/components/common/tag";
import { monthIdsUpTo } from "@/lib/finance/period";
import { useFinance } from "@/lib/finance/finance-provider";
import { useSettings } from "@/lib/settings/settings-provider";
import {
  buildCategoryPercentSeries,
  buildCategoryReference,
  buildMonthlyHistory,
  buildPlanningInsights,
  type CategoryReference,
} from "@/lib/planning/calculations";
import { cn } from "@/lib/utils";

const HISTORY_MONTHS = 6;

const TREND_LABEL: Record<CategoryReference["trend"], string> = {
  alta: "Em alta",
  queda: "Em queda",
  estavel: "Estável",
  indisponivel: "Sem histórico suficiente",
};

function TrendTag({ trend }: { trend: CategoryReference["trend"] }) {
  if (trend === "indisponivel" || trend === "estavel") {
    return (
      <span className="flex items-center gap-1 text-caption font-medium text-muted-foreground">
        {trend === "estavel" ? <Minus className="size-3.5" /> : null}
        {TREND_LABEL[trend]}
      </span>
    );
  }
  const Icon = trend === "alta" ? TrendingUp : TrendingDown;
  // "Alta" em gasto é o sinal de atenção; "queda" em gasto é uma boa notícia — cores invertidas em relação a um KPI de receita.
  const color = trend === "alta" ? "text-tangerine" : "text-vivid-green";
  return (
    <span className={cn("flex items-center gap-1 text-caption font-medium", color)}>
      <Icon className="size-3.5" /> {TREND_LABEL[trend]}
    </span>
  );
}

/** Seções 5 e 6 — referências históricas por categoria (médias, mediana, mín/máx, tendência simples) e observações descritivas. */
export function PlanningReferences({ monthId }: { monthId: string }) {
  const { transactions, categories } = useFinance();
  const { settings, updateSettings } = useSettings();

  function toggleTracked(categoryId: string) {
    const current = settings.planningTrackedCategoryIds;
    updateSettings({ planningTrackedCategoryIds: current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId] });
  }

  const monthIds = monthIdsUpTo(monthId, HISTORY_MONTHS);
  const despesaCategories = categories.filter((c) => c.group === "custo" || c.group === "despesa");
  const tracked =
    settings.planningTrackedCategoryIds.length > 0
      ? despesaCategories.filter((c) => settings.planningTrackedCategoryIds.includes(c.id))
      : despesaCategories;

  const references = tracked
    .map((c) => buildCategoryReference(c.id, c.label, buildCategoryPercentSeries(transactions, categories, c.id, monthIds)))
    .filter((ref) => ref.currentAmount > 0 || ref.trend !== "indisponivel");

  const marginHistory = buildMonthlyHistory(transactions, categories, [], monthIds).map((m) => ({
    monthId: m.monthId,
    margemPercent: m.margemPercent,
  }));
  const insights = buildPlanningInsights({ categoryReferences: references, marginHistory });

  return (
    <div className="flex flex-col gap-4">
      {insights.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Info className="size-4 text-muted-foreground" />
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {insights.map((insight) => (
              <p key={insight.id} className="text-body text-foreground">
                {insight.message}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Referências históricas</CardTitle>
          <CardDescription>Como cada categoria se compara à própria história da operação — sem metas prontas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-caption text-muted-foreground">Categorias acompanhadas (nenhuma marcada = todas)</span>
            <div className="flex flex-wrap gap-1.5">
              {despesaCategories.map((c) => (
                <button key={c.id} type="button" aria-pressed={settings.planningTrackedCategoryIds.includes(c.id)} onClick={() => toggleTracked(c.id)}>
                  <Tag color={settings.planningTrackedCategoryIds.includes(c.id) ? "blue" : "neutral"}>{c.label}</Tag>
                </button>
              ))}
            </div>
          </div>
          {references.length === 0 ? (
            <EmptyState
              className="border-0 py-6"
              title="Sem dados suficientes ainda"
              description="Referências aparecem depois de alguns meses de histórico com lançamentos."
            />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {references.map((ref) => (
                <div key={ref.categoryId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-body font-medium text-foreground">{ref.label}</span>
                    <TrendTag trend={ref.trend} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-caption text-muted-foreground sm:grid-cols-4">
                    <span>
                      Mês atual: <strong className="text-foreground">{ref.currentPercent.toFixed(1)}%</strong>
                    </span>
                    {ref.historicalAveragePercent !== undefined ? (
                      <span>
                        Média histórica: <strong className="text-foreground">{ref.historicalAveragePercent.toFixed(1)}%</strong>
                      </span>
                    ) : null}
                    {ref.recentAveragePercent !== undefined ? (
                      <span>
                        Últimos 3 meses: <strong className="text-foreground">{ref.recentAveragePercent.toFixed(1)}%</strong>
                      </span>
                    ) : null}
                    {ref.min !== undefined && ref.max !== undefined ? (
                      <span>
                        Mín–máx: <strong className="text-foreground">{ref.min.toFixed(1)}%–{ref.max.toFixed(1)}%</strong>
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
