"use client";

import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/common/currency-input";
import { DateInput } from "@/components/common/date-input";
import { DrawerForm, DrawerFormActions } from "@/components/common/drawer-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCampaigns } from "@/lib/campaigns/campaigns-provider";
import { CHANNEL_LABELS, CHANNEL_UTM_DEFAULTS, toUtmSlug, uniqueUtmCampaign } from "@/lib/campaigns/calculations";
import type { Campaign, CampaignChannel } from "@/lib/campaigns/types";

function toISODate(date?: Date): string {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function CampaignForm({ campaign, onDone, onSaved }: { campaign?: Campaign; onDone: () => void; onSaved?: (c: Campaign) => void }) {
  const { campaigns, addCampaign, updateCampaign } = useCampaigns();
  const isEditing = Boolean(campaign);

  const [name, setName] = React.useState(campaign?.name ?? "");
  const [channel, setChannel] = React.useState<CampaignChannel>(campaign?.channel ?? "instagram");
  const [start, setStart] = React.useState<Date | undefined>(toDate(campaign?.startDate) ?? new Date());
  const [end, setEnd] = React.useState<Date | undefined>(toDate(campaign?.endDate));
  const [cost, setCost] = React.useState(campaign?.cost ?? 0);
  const [notes, setNotes] = React.useState(campaign?.notes ?? "");
  const [utmSource, setUtmSource] = React.useState(campaign?.utmSource ?? CHANNEL_UTM_DEFAULTS.instagram.source);
  const [utmMedium, setUtmMedium] = React.useState(campaign?.utmMedium ?? CHANNEL_UTM_DEFAULTS.instagram.medium);

  // A utm_campaign nasce do nome e não muda depois de criada: links já
  // espalhados por aí continuariam apontando para o nome antigo.
  const utmCampaign = campaign?.utmCampaign ?? uniqueUtmCampaign(name, campaigns);

  function changeChannel(next: CampaignChannel) {
    setChannel(next);
    if (!isEditing) {
      setUtmSource(CHANNEL_UTM_DEFAULTS[next].source);
      setUtmMedium(CHANNEL_UTM_DEFAULTS[next].medium);
    }
  }

  function handleSubmit() {
    if (!name.trim()) return toast.error("Dê um nome à campanha.");
    if (!start) return toast.error("Informe a data de início.");
    if (end && toISODate(end) < toISODate(start)) return toast.error("O fim não pode ser antes do início.");
    const source = toUtmSlug(utmSource);
    const medium = toUtmSlug(utmMedium);
    if (!source || !medium) return toast.error("Preencha a origem e o formato da UTM.");

    const input = {
      name: name.trim(),
      channel,
      startDate: toISODate(start),
      endDate: end ? toISODate(end) : undefined,
      cost: cost > 0 ? cost : undefined,
      notes: notes.trim() || undefined,
      utmSource: source,
      utmMedium: medium,
      utmCampaign,
    };
    if (isEditing && campaign) {
      updateCampaign(campaign.id, input);
      toast.success("Campanha atualizada.");
      onDone();
    } else {
      const created = addCampaign(input);
      toast.success("Campanha criada — gere o link rastreável na página dela.");
      if (onSaved) onSaved(created);
      else onDone();
    }
  }

  return (
    <>
      <DrawerForm>
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Drop NREM outubro" autoFocus />
        </Field>
        <Field label="Canal">
          <Select value={channel} onValueChange={(v) => changeChannel(v as CampaignChannel)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(CHANNEL_LABELS) as CampaignChannel[]).map((c) => (
                <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início"><DateInput value={start} onValueChange={setStart} /></Field>
          <Field label="Fim" optional><DateInput value={end} onValueChange={setEnd} /></Field>
        </div>
        <Field label="Custo" optional hint="Deixe zerado se for orgânica.">
          <CurrencyInput value={cost} onValueChange={setCost} />
        </Field>
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <span className="text-caption font-medium text-foreground">UTM da campanha</span>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origem (utm_source)"><Input value={utmSource} onChange={(e) => setUtmSource(e.target.value)} /></Field>
            <Field label="Formato (utm_medium)"><Input value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} /></Field>
          </div>
          <span className="text-caption text-muted-foreground">
            utm_campaign: <b className="text-foreground">{utmCampaign || "—"}</b>
            {isEditing ? " (fixa: links já usados continuam valendo)" : " (gerada do nome)"}
          </span>
        </div>
        <Field label="Observação" optional>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </DrawerForm>
      <DrawerFormActions onCancel={onDone} onSubmit={handleSubmit} submitLabel={isEditing ? "Salvar" : "Criar campanha"} />
    </>
  );
}
