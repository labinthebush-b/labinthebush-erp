"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildUtmUrl } from "@/lib/marketing/funnel";

const STORE_URL_KEY = "erp-marketing-store-url";

// Canais e formatos do plano de mensuração (PLANO_MENSURACAO_MARKETING.md, 1.3).
const SOURCES = [
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "tiktok", label: "TikTok" },
];
const MEDIUMS = [
  { value: "bio", label: "Link da bio" },
  { value: "stories", label: "Stories" },
  { value: "post", label: "Post / Reels" },
  { value: "direct", label: "Direct / mensagem" },
  { value: "organic", label: "Outro orgânico" },
];

function readStoredUrl(): string {
  try {
    return window.localStorage.getItem(STORE_URL_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Gera o link rastreável para colocar no Instagram/WhatsApp: é o que permite,
 * depois, o Google Analytics dizer de onde veio cada visita (meio do funil).
 */
export function UtmBuilder({
  onDone,
  preset,
}: {
  onDone: () => void;
  /** Link de uma campanha cadastrada: source/medium/campaign vêm dela e ficam travados; só o "content" é livre. */
  preset?: { source: string; medium: string; campaign: string };
}) {
  const [base, setBase] = React.useState(readStoredUrl);
  const [source, setSource] = React.useState(preset?.source ?? "instagram");
  const [medium, setMedium] = React.useState(preset?.medium ?? "stories");
  const [campaign, setCampaign] = React.useState(preset?.campaign ?? "");
  const [content, setContent] = React.useState("");

  const url = campaign.trim() ? buildUtmUrl(base, { source, medium, campaign, content }) : null;

  async function copy() {
    if (!url) return;
    try {
      window.localStorage.setItem(STORE_URL_KEY, base.trim());
    } catch {
      // armazenamento indisponível: só não lembramos o endereço da loja
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado — cole no Instagram ou no WhatsApp.");
      onDone();
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Link da loja ou do produto" hint="Fica lembrado neste aparelho.">
        <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://sualoja.com.br/produtos/camiseta" />
      </Field>
      {preset ? (
        <p className="rounded-lg bg-paper-mist p-2 text-caption text-muted-foreground">
          Da campanha: utm_source=<b>{preset.source}</b> · utm_medium=<b>{preset.medium}</b> · utm_campaign=<b>{preset.campaign}</b>
        </p>
      ) : null}
      <div className={preset ? "hidden" : "grid grid-cols-2 gap-3"}>
        <Field label="Onde vai postar">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Formato">
          <Select value={medium} onValueChange={setMedium}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MEDIUMS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {preset ? null : (
        <Field label="Campanha" hint="Ex.: drop NREM, coleção verão. Vira “drop-nrem”.">
          <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="drop NREM" />
        </Field>
      )}
      <Field label="Identificador do link" optional hint="utm_content — ex.: “stories 1”, “bio”, “post carrossel”. Diferencia os links da mesma campanha.">
        <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="stories 1" />
      </Field>

      <div className="rounded-lg bg-paper-mist p-3 text-caption break-all text-foreground">
        {url ?? (campaign.trim() ? "Confira o link da loja — ele precisa ser um endereço válido." : "Preencha a campanha para gerar o link.")}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>Cancelar</Button>
        <Button onClick={copy} disabled={!url}>
          <Copy className="size-4" />
          Copiar link
        </Button>
      </div>
    </div>
  );
}
