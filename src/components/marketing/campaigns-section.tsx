"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Tag } from "@/components/common/tag";
import { useUI } from "@/components/providers/ui-provider";
import { CampaignForm } from "@/components/marketing/campaign-form";
import { CampaignDetail } from "@/components/marketing/campaign-detail";
import { useCampaigns } from "@/lib/campaigns/campaigns-provider";
import { CHANNEL_LABELS, campaignStatus } from "@/lib/campaigns/calculations";
import { todayISO } from "@/lib/finance/actions";
import { formatCurrencyCents } from "@/lib/currency";
import type { Campaign } from "@/lib/campaigns/types";

function formatDate(iso?: string) {
  return iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR") : "—";
}

export function CampaignsSection() {
  const { campaigns, posts } = useCampaigns();
  const { openDrawer, closeDrawer } = useUI();
  const today = todayISO();

  function openDetail(campaign: Campaign) {
    openDrawer({
      title: campaign.name,
      description: `utm_campaign=${campaign.utmCampaign}`,
      widthClassName: "sm:max-w-lg",
      content: <CampaignDetail campaignId={campaign.id} onClose={closeDrawer} />,
    });
  }

  function openCreate() {
    openDrawer({
      title: "Nova campanha",
      description: "Registre a campanha para saber o que veio dela.",
      content: <CampaignForm onDone={closeDrawer} onSaved={openDetail} />,
    });
  }

  const sorted = [...campaigns].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

  const columns: DataTableColumn<Campaign>[] = [
    { key: "name", header: "Campanha", render: (c) => <span className="text-foreground">{c.name}</span> },
    { key: "channel", header: "Canal", render: (c) => <Tag>{CHANNEL_LABELS[c.channel]}</Tag> },
    {
      key: "status",
      header: "Situação",
      render: (c) => {
        const s = campaignStatus(c, today);
        return <Tag color={s === "ativa" ? "green" : s === "agendada" ? "blue" : "neutral"}>{s}</Tag>;
      },
    },
    { key: "period", header: "Período", render: (c) => `${formatDate(c.startDate)} → ${c.endDate ? formatDate(c.endDate) : "…"}` },
    { key: "posts", header: "Posts", align: "right", render: (c) => posts.filter((p) => p.campaignId === c.id).length },
    { key: "cost", header: "Custo", align: "right", render: (c) => (c.cost ? formatCurrencyCents(c.cost) : "orgânica") },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle>Campanhas</CardTitle>
          <CardDescription>Cada campanha tem a sua UTM. Abra uma para ver o alcance dos posts e as visitas que ela trouxe.</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" /> Nova campanha
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={sorted}
          onRowClick={openDetail}
          emptyTitle="Nenhuma campanha registrada"
          emptyDescription="Registre uma campanha para gerar o link rastreável e acompanhar o que ela trouxe."
          emptyAction={
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Nova campanha
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
