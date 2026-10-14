"use client";

import * as React from "react";
import { toast } from "sonner";
import { ExternalLink, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag } from "@/components/common/tag";
import { useUI } from "@/components/providers/ui-provider";
import { UtmBuilder } from "@/components/marketing/utm-builder";
import { CampaignForm } from "@/components/marketing/campaign-form";
import { useCampaigns } from "@/lib/campaigns/campaigns-provider";
import {
  CHANNEL_LABELS,
  SMALL_SAMPLE_VISITS,
  campaignMeasureRange,
  campaignStatus,
  costPerVisit,
} from "@/lib/campaigns/calculations";
import { todayISO } from "@/lib/finance/actions";
import { formatCurrencyCents } from "@/lib/currency";
import type { InstagramMedia } from "@/lib/campaigns/types";

const integer = new Intl.NumberFormat("pt-BR");

type MetricsResponse = {
  site: { ok: true; data: { sessions: number; users: number } } | { ok: false; error: string };
  reach: { ok: true; data: Record<string, number | undefined> } | { ok: false; error: string };
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("pt-BR");
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border p-3">
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="font-display text-heading-sm text-foreground">{value}</span>
      {hint ? <span className="text-caption text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** Lista os posts recentes da conta para ligar à campanha. */
function PostPicker({ campaignId, onDone }: { campaignId: string; onDone: () => void }) {
  const { posts, linkPost } = useCampaigns();
  const [media, setMedia] = React.useState<InstagramMedia[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/marketing/instagram-media")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
        setMedia(body.media);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-caption text-destructive">{error}</p>;
  if (!media) return <div className="flex flex-col gap-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>;

  return (
    <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
      {media.map((m) => {
        const link = posts.find((p) => p.id === m.id);
        const here = link?.campaignId === campaignId;
        const elsewhere = Boolean(link?.campaignId) && !here;
        return (
          <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
            {m.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- miniatura remota do Instagram
              <img src={m.thumbnailUrl} alt="" className="size-12 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="size-12 shrink-0 rounded-md bg-paper-mist" />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-caption text-foreground">{m.caption?.split("\n")[0] || "(sem legenda)"}</span>
              <span className="text-[11px] text-muted-foreground">
                {formatDate(m.timestamp)} · {m.mediaType.toLowerCase().replace("_", " ")}
                {elsewhere ? " · em outra campanha" : ""}
              </span>
            </div>
            <Button
              size="sm"
              variant={here ? "secondary" : "outline"}
              disabled={here}
              onClick={() => {
                linkPost(m.id, campaignId);
                toast.success(elsewhere ? "Post movido para esta campanha." : "Post ligado à campanha.");
              }}
            >
              {here ? "Ligado" : "Ligar"}
            </Button>
          </div>
        );
      })}
      <div className="flex justify-end pt-1">
        <Button variant="outline" onClick={onDone}>Fechar</Button>
      </div>
    </div>
  );
}

/**
 * Página da campanha. Mostra o que já dá para medir (alcance dos posts e
 * visitas no site, ao vivo) e deixa explícito o que só passa a existir nas
 * próximas etapas do plano (contatos, vendas e receita atribuídos, cupons).
 */
export function CampaignDetail({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const { campaigns, posts, unlinkPost, deleteCampaign } = useCampaigns();
  const { openDrawer, closeDrawer, openModal, closeModal, confirm } = useUI();
  const campaign = campaigns.find((c) => c.id === campaignId);
  const linked = posts.filter((p) => p.campaignId === campaignId);
  const linkedKey = linked.map((p) => p.id).sort().join(",");
  const [metrics, setMetrics] = React.useState<MetricsResponse | null>(null);
  const [media, setMedia] = React.useState<Record<string, InstagramMedia>>({});

  const today = todayISO();
  const range = campaign ? campaignMeasureRange(campaign, today) : null;

  React.useEffect(() => {
    if (!campaign || !range) return;
    let cancelled = false;
    const params = new URLSearchParams({ utm: campaign.utmCampaign, start: range.start, end: range.end, media: linkedKey });
    fetch(`/api/marketing/campaign-metrics?${params}`)
      .then((res) => res.json())
      .then((body: MetricsResponse) => !cancelled && setMetrics(body))
      .catch(() => !cancelled && setMetrics({ site: { ok: false, error: "Falha de conexão." }, reach: { ok: false, error: "Falha de conexão." } }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega quando muda a campanha, o período ou os posts ligados
  }, [campaign?.utmCampaign, range?.start, range?.end, linkedKey]);

  React.useEffect(() => {
    if (linked.length === 0) return;
    fetch("/api/marketing/instagram-media")
      .then((res) => res.json())
      .then((body: { media?: InstagramMedia[] }) => setMedia(Object.fromEntries((body.media ?? []).map((m) => [m.id, m]))))
      .catch(() => undefined);
  }, [linked.length]);

  if (!campaign) return <p className="py-6 text-body text-muted-foreground">Esta campanha não existe mais.</p>;

  const status = campaignStatus(campaign, today);
  const sessions = metrics?.site.ok ? metrics.site.data.sessions : undefined;
  const reachValues = metrics?.reach.ok ? linked.map((p) => (metrics.reach.ok ? metrics.reach.data[p.id] : undefined)) : [];
  const totalReach = reachValues.some((v) => v !== undefined) ? reachValues.reduce<number>((s, v) => s + (v ?? 0), 0) : undefined;
  const cpv = costPerVisit(campaign.cost, sessions);

  function openLink() {
    openModal({
      title: `Link rastreável — ${campaign!.name}`,
      description: "Use este link nos posts, stories e mensagens desta campanha.",
      content: <UtmBuilder preset={{ source: campaign!.utmSource, medium: campaign!.utmMedium, campaign: campaign!.utmCampaign }} onDone={closeModal} />,
    });
  }

  function openPicker() {
    openModal({ title: "Ligar posts à campanha", description: "Posts recentes do Instagram da marca.", content: <PostPicker campaignId={campaign!.id} onDone={closeModal} />, widthClassName: "sm:max-w-lg" });
  }

  function openEdit() {
    openDrawer({ title: "Editar campanha", content: <CampaignForm campaign={campaign} onDone={closeDrawer} /> });
  }

  return (
    <div className="flex flex-col gap-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tag color={status === "ativa" ? "green" : status === "agendada" ? "blue" : "neutral"}>{status}</Tag>
        <Tag>{CHANNEL_LABELS[campaign.channel]}</Tag>
        <span className="text-caption text-muted-foreground">
          {formatDate(campaign.startDate)} → {campaign.endDate ? formatDate(campaign.endDate) : "sem data de fim"}
        </span>
        {campaign.cost ? <span className="text-caption text-muted-foreground">· custo {formatCurrencyCents(campaign.cost)}</span> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={openLink}><Link2 className="size-3.5" /> Gerar link rastreável</Button>
        <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="size-3.5" /> Editar</Button>
      </div>

      {!range ? (
        <p className="rounded-lg bg-paper-mist p-3 text-caption text-muted-foreground">A campanha ainda não começou — as métricas aparecem a partir de {formatDate(campaign.startDate)}.</p>
      ) : (
        <section className="flex flex-col gap-2">
          <h3 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Resultado ({formatDate(range.start)} → {formatDate(range.end)})</h3>
          <div className="grid grid-cols-2 gap-2">
            <Metric
              label="Alcance dos posts ligados"
              value={!metrics ? <Skeleton className="h-7 w-16" /> : linked.length === 0 ? "—" : totalReach === undefined ? "—" : integer.format(totalReach)}
              hint={linked.length === 0 ? "Nenhum post ligado" : metrics && !metrics.reach.ok ? metrics.reach.error : `${linked.length} ${linked.length === 1 ? "post" : "posts"}`}
            />
            <Metric
              label="Visitas ao site"
              value={!metrics ? <Skeleton className="h-7 w-16" /> : sessions === undefined ? "—" : integer.format(sessions)}
              hint={metrics && !metrics.site.ok ? metrics.site.error : cpv !== undefined ? `${formatCurrencyCents(cpv)} por visita` : "pelo link com esta UTM"}
            />
            <Metric label="Contatos gerados" value="—" hint="passa a contar na etapa 2–3 (origem do contato)" />
            <Metric label="Vendas e receita" value="—" hint="passa a contar nas etapas 2–4 (origem/cupom na venda)" />
          </div>
          {sessions !== undefined && sessions < SMALL_SAMPLE_VISITS ? (
            <p className="text-caption text-[#92400e]">
              Amostra pequena ({sessions} {sessions === 1 ? "visita" : "visitas"}): ainda não dá para concluir nada sobre o desempenho desta campanha.
            </p>
          ) : null}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Posts ligados</h3>
          <Button size="sm" variant="outline" onClick={openPicker}><Plus className="size-3.5" /> Ligar posts</Button>
        </div>
        {linked.length === 0 ? (
          <p className="text-caption text-muted-foreground">Nenhum post ligado ainda.</p>
        ) : (
          linked.map((p) => {
            const m = media[p.id];
            const r = metrics?.reach.ok ? metrics.reach.data[p.id] : undefined;
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                {m?.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura remota do Instagram
                  <img src={m.thumbnailUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="size-10 shrink-0 rounded-md bg-paper-mist" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-caption text-foreground">{m?.caption?.split("\n")[0] || `Post ${p.id}`}</span>
                  <span className="text-[11px] text-muted-foreground">{m ? formatDate(m.timestamp) : ""}{r !== undefined ? ` · alcance ${integer.format(r)}` : ""}</span>
                </div>
                {m?.permalink ? (
                  <Button size="icon-sm" variant="ghost" asChild aria-label="Abrir post">
                    <a href={m.permalink} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /></a>
                  </Button>
                ) : null}
                <Button size="icon-sm" variant="ghost" aria-label="Desligar post" onClick={() => unlinkPost(p.id)}>
                  <X className="size-3.5" />
                </Button>
              </div>
            );
          })
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Cupons</h3>
        <p className="text-caption text-muted-foreground">Cupons ligados à campanha chegam na etapa 4.</p>
      </section>

      {campaign.notes ? (
        <section className="flex flex-col gap-1">
          <h3 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Observação</h3>
          <p className="whitespace-pre-wrap text-body text-foreground">{campaign.notes}</p>
        </section>
      ) : null}

      <div className="border-t border-border pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() =>
            confirm({
              title: "Excluir campanha?",
              description: "A campanha some da lista. Os posts continuam no Instagram e no ERP (só deixam de estar ligados a ela). Links já publicados continuam funcionando no site.",
              onConfirm: () => {
                deleteCampaign(campaign.id);
                toast.success("Campanha excluída.");
                onClose();
              },
            })
          }
        >
          <Trash2 className="size-3.5" /> Excluir campanha
        </Button>
      </div>
    </div>
  );
}
