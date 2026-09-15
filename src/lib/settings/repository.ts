// Settings is one row per user, not a collection — fetch returns a single
// object (or the defaults, if the row doesn't exist yet) and sync is a plain
// upsert, no diffing needed.

import { createClient } from "@/lib/supabase/client";
import { DEFAULT_SETTINGS, type Settings } from "./types";

type SettingsRow = {
  user_id: string;
  margin_threshold_percent: number;
  dashboard_detailed: boolean;
  hidden_dashboard_widgets: string[];
  pipeline_stages: Settings["pipelineStages"];
  planning_tracked_category_ids: string[];
  nuvemshop_fee_bps: number;
  updated_at: string;
};

function rowToSettings(row: SettingsRow): Settings {
  return {
    marginThresholdPercent: row.margin_threshold_percent,
    dashboardDetailed: row.dashboard_detailed,
    hiddenDashboardWidgets: row.hidden_dashboard_widgets ?? [],
    pipelineStages: row.pipeline_stages ?? DEFAULT_SETTINGS.pipelineStages,
    planningTrackedCategoryIds: row.planning_tracked_category_ids ?? [],
    // Guardado em centésimos de ponto percentual (499 = 4,99%) para não usar
    // `numeric` do Postgres, que o supabase-js devolve como string.
    nuvemshopFeePercent: (row.nuvemshop_fee_bps ?? 0) / 100,
  };
}

export async function fetchSettings(userId: string): Promise<Settings> {
  const { data, error } = await createClient().from("settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_SETTINGS;
  return rowToSettings(data as SettingsRow);
}

export async function upsertSettings(userId: string, settings: Settings): Promise<void> {
  const row: SettingsRow = {
    user_id: userId,
    margin_threshold_percent: settings.marginThresholdPercent,
    dashboard_detailed: settings.dashboardDetailed,
    hidden_dashboard_widgets: settings.hiddenDashboardWidgets,
    pipeline_stages: settings.pipelineStages,
    planning_tracked_category_ids: settings.planningTrackedCategoryIds,
    nuvemshop_fee_bps: Math.round(settings.nuvemshopFeePercent * 100),
    updated_at: new Date().toISOString(),
  };
  const { error } = await createClient().from("settings").upsert(row);
  if (error) throw error;
}
