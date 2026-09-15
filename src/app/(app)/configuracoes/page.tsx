"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Field } from "@/components/common/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useSettings } from "@/lib/settings/settings-provider";
import { DASHBOARD_WIDGETS } from "@/lib/settings/types";
import type { PipelineStage } from "@/lib/contacts/pipeline";
import { ExportBackupButton } from "@/components/settings/export-backup-button";
import { AiIntegrationPanel } from "@/components/settings/ai-integration-panel";

let stageIdCounter = 0;
function newStageId() {
  stageIdCounter += 1;
  return `estagio-${Date.now()}-${stageIdCounter}`;
}

export default function ConfiguracoesPage() {
  const { settings, updateSettings, toggleWidget } = useSettings();
  const [newStageLabel, setNewStageLabel] = React.useState("");
  const stages = settings.pipelineStages;

  function updateStages(next: PipelineStage[]) {
    updateSettings({ pipelineStages: next });
  }

  function renameStage(id: string, label: string) {
    updateStages(stages.map((s) => (s.id === id ? { ...s, label } : s)));
  }

  function removeStage(id: string) {
    if (stages.length <= 1) {
      toast.error("Mantenha pelo menos um estágio.");
      return;
    }
    updateStages(stages.filter((s) => s.id !== id));
    toast.success("Estágio removido. Contatos nesse estágio caem no primeiro estágio da lista.");
  }

  function moveStage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[index], next[target]] = [next[target], next[index]];
    updateStages(next);
  }

  function addStage() {
    if (!newStageLabel.trim()) return;
    updateStages([...stages, { id: newStageId(), label: newStageLabel.trim() }]);
    setNewStageLabel("");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações"
        description="Preferências gerais do ERP."
      />

      <Card>
        <CardHeader>
          <CardTitle>Alertas de negócio</CardTitle>
          <CardDescription>Controla quando um produto é sinalizado com margem baixa.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label="Margem mínima aceitável" hint="Produtos com margem igual ou abaixo deste percentual aparecem na central de notificações.">
            <div className="flex max-w-40 items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.marginThresholdPercent}
                onChange={(e) => {
                  const value = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                  updateSettings({ marginThresholdPercent: value });
                  toast.success("Preferência salva.");
                }}
              />
              <span className="text-body text-muted-foreground">%</span>
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Canais de venda</CardTitle>
          <CardDescription>Taxa cobrada pela Nuvemshop sobre o valor da venda — usada no cálculo de vendas desse canal.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label="Taxa Nuvemshop" hint="0% = sem taxa aplicada. Consulte o valor exato no seu contrato/painel da Nuvemshop.">
            <div className="flex max-w-40 items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={settings.nuvemshopFeePercent}
                onChange={(e) => {
                  const value = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                  updateSettings({ nuvemshopFeePercent: value });
                  toast.success("Preferência salva.");
                }}
              />
              <span className="text-body text-muted-foreground">%</span>
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Personalize a visão inicial do ERP.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-body font-medium text-foreground">Visão detalhada por padrão</p>
              <p className="text-caption text-muted-foreground">Mostra os cards do Dashboard com mais números logo de início.</p>
            </div>
            <Switch
              checked={settings.dashboardDetailed}
              onCheckedChange={(checked) => updateSettings({ dashboardDetailed: checked })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-body font-medium text-foreground">Widgets visíveis</p>
            {DASHBOARD_WIDGETS.map((widget) => (
              <div key={widget.id} className="flex items-center justify-between rounded-lg bg-paper-mist px-3 py-2">
                <span className="text-body text-foreground">{widget.label}</span>
                <Switch
                  checked={!settings.hiddenDashboardWidgets.includes(widget.id)}
                  onCheckedChange={() => toggleWidget(widget.id)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline de contatos (CRM)</CardTitle>
          <CardDescription>Personalize os estágios usados no Kanban de Contatos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-2">
              <Input value={stage.label} onChange={(e) => renameStage(stage.id, e.target.value)} className="flex-1" />
              <Button variant="ghost" size="icon-sm" aria-label="Mover para cima" disabled={index === 0} onClick={() => moveStage(index, -1)}>
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Mover para baixo"
                disabled={index === stages.length - 1}
                onClick={() => moveStage(index, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Remover estágio" onClick={() => removeStage(stage.id)}>
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <Input
              value={newStageLabel}
              onChange={(e) => setNewStageLabel(e.target.value)}
              placeholder="Novo estágio..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addStage();
                }
              }}
            />
            <Button variant="outline" size="icon" onClick={addStage} aria-label="Adicionar estágio">
              <Plus className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup</CardTitle>
          <CardDescription>Exporte todos os dados do ERP em um único arquivo JSON.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExportBackupButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integração com IA</CardTitle>
          <CardDescription>Conecte assistentes de IA externos (ChatGPT, Claude) ao ERP via MCP.</CardDescription>
        </CardHeader>
        <CardContent>
          <AiIntegrationPanel />
        </CardContent>
      </Card>
    </div>
  );
}
