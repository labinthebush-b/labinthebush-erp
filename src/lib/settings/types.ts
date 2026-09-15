// App-wide, single-user preferences — small and flat on purpose.

import { DEFAULT_PIPELINE_STAGES, type PipelineStage } from "@/lib/contacts/pipeline";

export type Settings = {
  /** Products at or below this margin trigger a "Margem baixa" notification. */
  marginThresholdPercent: number;
  /** Dashboard view density. */
  dashboardDetailed: boolean;
  /** Ids of dashboard widgets the user chose to hide. */
  hiddenDashboardWidgets: string[];
  /** Contatos CRM pipeline stages — user-customizable (add/rename/remove). */
  pipelineStages: PipelineStage[];
  /** Category["id"]s tracked in Financeiro → Planejamento. Empty means "todas". */
  planningTrackedCategoryIds: string[];
  /** Taxa cobrada pela Nuvemshop sobre o valor da venda, em % (ex.: 4.99). 0 = não configurada — nenhuma taxa é aplicada até o usuário preencher aqui (ver lib/sales/calculations.ts:calculateNuvemshopFee). */
  nuvemshopFeePercent: number;
};

export const DEFAULT_SETTINGS: Settings = {
  marginThresholdPercent: 15,
  dashboardDetailed: false,
  hiddenDashboardWidgets: [],
  pipelineStages: DEFAULT_PIPELINE_STAGES,
  planningTrackedCategoryIds: [],
  nuvemshopFeePercent: 0,
};

export const DASHBOARD_WIDGETS = [
  { id: "fluxo-caixa", label: "Fluxo de caixa da semana" },
  { id: "tendencia-vendas", label: "Tendência de vendas" },
  { id: "ultimas-vendas", label: "Últimas vendas" },
  { id: "alertas", label: "Alertas" },
  { id: "proximos-pagamentos", label: "Próximos pagamentos" },
  { id: "tarefas-prioritarias", label: "Tarefas prioritárias" },
] as const;
