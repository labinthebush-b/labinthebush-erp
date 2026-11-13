"use client";

import { PlanningOverview } from "@/components/finance/planning-overview";
import { PlanningHistory } from "@/components/finance/planning-history";
import { PlanningReferences } from "@/components/finance/planning-references";
import { PlanningBudgets } from "@/components/finance/planning-budgets";

/**
 * Financeiro → Planejamento: uma camada de interpretação sobre os dados já
 * existentes no Financeiro — visão geral e destinação do resultado,
 * histórico mensal, referências históricas com
 * observações descritivas, e metas opcionais (planejado × realizado).
 * Nenhum cálculo financeiro novo é criado aqui.
 */
export function PlanningPanel({ monthId }: { monthId: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PlanningOverview monthId={monthId} />
      <PlanningHistory monthId={monthId} />
      <PlanningReferences monthId={monthId} />
      <PlanningBudgets monthId={monthId} />
    </div>
  );
}
