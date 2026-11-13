"use client";

/* eslint-disable @next/next/no-img-element -- fotos vêm do CDN da loja (Nuvemshop); não passam pelo otimizador do Next */

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Bot } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { formatCurrencyCents } from "@/lib/currency";
import { FEATURED_COLLECTION } from "@/lib/brand";
import type { CashflowPoint } from "@/lib/finance/overview";
import type { NextAction } from "@/lib/dashboard/next-action";
import { describeActivity, viaLabel } from "@/lib/activity/format";
import { fetchAccountProfiles, fetchActivity, type ActivityEntry, type UserProfile } from "@/lib/activity/repository";
import { useSupabaseUser } from "@/lib/supabase/use-supabase-user";
import { cn } from "@/lib/utils";

const integer = new Intl.NumberFormat("pt-BR");

/** Botão redondo com a seta ↗ das referências — abre o módulo do card. */
export function OpenArrow({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-paper-mist", className)}
    >
      <ArrowUpRight className="size-4" />
    </Link>
  );
}

export type TodayItem = { id: string; strong: string; text: string; href: string };

/** Faixa "Hoje": o que vence ou acontece hoje, numa pílula com o degradê. */
export function TodayStrip({ items }: { items: TodayItem[] }) {
  return (
    <section aria-label="Hoje" className="brand-gradient brand-gradient-animated flex flex-wrap items-center gap-2 rounded-[28px] p-2">
      <span className="flex h-11 items-center rounded-full bg-primary px-5 text-body font-medium text-primary-foreground">Hoje</span>
      {items.length === 0 ? (
        <span className="flex h-11 items-center rounded-full bg-white/80 px-4 text-body">Nada vencendo hoje. Dia livre para criar.</span>
      ) : (
        items.map((item) => (
          <Link key={item.id} href={item.href} className="flex h-11 items-center gap-2 rounded-full bg-white/80 px-4 text-body transition-colors hover:bg-white">
            <span className="font-semibold">{item.strong}</span>
            {item.text}
          </Link>
        ))
      )}
    </section>
  );
}

/** Banner da coleção com os números do período por cima, em vidro. */
export function CollectionHero({
  revenue,
  salesCount,
  profit,
  visits,
}: {
  revenue: number;
  salesCount: number;
  profit: number;
  visits?: number;
}) {
  const stats = [
    { label: "faturamento", value: formatCurrencyCents(revenue), bar: "from-brand-blue to-brand-aqua" },
    { label: salesCount === 1 ? "venda" : "vendas", value: integer.format(salesCount), bar: "from-brand-sky to-brand-mist" },
    { label: "lucro estimado", value: formatCurrencyCents(profit), bar: "from-brand-aqua to-brand-blue" },
    { label: "visitas na loja", value: visits === undefined ? "—" : integer.format(visits), bar: "from-brand-mist to-brand-sky" },
  ];
  return (
    <section aria-label={`Coleção ${FEATURED_COLLECTION.name}`} className="relative flex min-h-[420px] flex-col justify-between overflow-hidden rounded-[32px] bg-silver p-5">
      <img src={FEATURED_COLLECTION.banner} alt={FEATURED_COLLECTION.bannerAlt} className="absolute inset-0 size-full object-cover" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="flex h-9 items-center rounded-full bg-white/85 px-4 text-caption font-medium backdrop-blur">Coleção atual · {FEATURED_COLLECTION.name}</span>
        <OpenArrow href="/produtos" label="Ver os produtos" className="border-0 bg-white/85" />
      </div>
      <div className="relative flex flex-wrap gap-x-8 gap-y-4 rounded-[26px] bg-white/85 px-6 py-5 backdrop-blur-md">
        {stats.map((stat) => (
          <div key={stat.label} className="flex min-w-28 flex-col gap-1">
            <span className="font-display text-heading-lg leading-none">{stat.value}</span>
            <span className="text-body text-muted-foreground">{stat.label}</span>
            <span className={cn("h-[3px] w-14 rounded-full bg-linear-to-r", stat.bar)} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function CaixaCard({ caixa, series }: { caixa: number; series: CashflowPoint[] }) {
  return (
    <Card className="gap-2 px-5">
      <div className="flex items-center justify-between">
        <h2 className="text-body font-medium text-muted-foreground">Caixa agora</h2>
        <OpenArrow href="/financeiro" label="Abrir o Financeiro" />
      </div>
      <span className="font-display text-heading-lg">{formatCurrencyCents(caixa)}</span>
      <div className="h-28" role="img" aria-label="Caixa acumulado mês a mês">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="dash-cx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6aa5cf" stopOpacity={0.45} />
                <stop offset="1" stopColor="#6aa5cf" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              cursor={{ stroke: "#0f1f2b", strokeDasharray: "3 5" }}
              formatter={(value) => [formatCurrencyCents(Number(value)), "Caixa"]}
              labelFormatter={(_, payload) => (payload?.[0]?.payload as CashflowPoint | undefined)?.label ?? ""}
              contentStyle={{ borderRadius: 16, border: "1px solid #dcebf4" }}
            />
            <Area type="monotone" dataKey="caixa" stroke="#2d6f96" strokeWidth={2.6} fill="url(#dash-cx)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function TopProductCard({ name, image, quantity, revenue }: { name: string; image?: string; quantity: number; revenue: number }) {
  return (
    <Card className="flex-row items-stretch gap-3 p-2.5">
      <div className="flex flex-1 flex-col justify-between gap-2 p-3">
        <h2 className="text-body font-medium text-muted-foreground">Mais vendida</h2>
        <span className="font-display text-subheading">{name}</span>
        <span className="text-body text-muted-foreground">
          <span className="font-semibold text-foreground">{quantity} {quantity === 1 ? "vendida" : "vendidas"}</span> · {formatCurrencyCents(revenue)}
        </span>
      </div>
      {image ? (
        <img src={image} alt={name} className="h-40 w-36 shrink-0 rounded-[22px] bg-paper-mist object-cover" />
      ) : (
        <div className="flex h-40 w-36 shrink-0 items-center justify-center rounded-[22px] bg-paper-mist text-center text-caption text-muted-foreground">sem foto</div>
      )}
    </Card>
  );
}

export function NextActionCard({ action }: { action: NextAction | null }) {
  return (
    <section aria-label="Próxima ação" className="brand-gradient brand-gradient-animated flex min-h-64 flex-col justify-between gap-4 rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <span className="text-caption font-semibold uppercase tracking-wide">Próxima ação</span>
        {action ? <span className="rounded-full bg-white/70 px-3 py-1 text-caption font-medium">{action.tag}</span> : null}
      </div>
      {action ? (
        <>
          <div className="flex flex-col gap-2">
            <span className="font-display text-heading leading-tight">{action.title}</span>
            <span className="text-body-lg">{action.description}</span>
          </div>
          <Link href={action.href} className="flex h-11 w-fit items-center gap-2 rounded-full bg-primary px-5 text-body font-medium text-primary-foreground">
            {action.cta} <ArrowUpRight className="size-4" />
          </Link>
        </>
      ) : (
        <span className="font-display text-heading leading-tight">Tudo em dia.</span>
      )}
    </section>
  );
}

const timeFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const DOT_COLORS = ["bg-electric-blue", "bg-brand-aqua", "bg-brand-sky", "bg-primary"];

/** Últimas atividades em linha do tempo vertical (o log de Atividades resumido). */
export function RecentActivityCard({ limit = 5 }: { limit?: number }) {
  const { userId } = useSupabaseUser();
  const [entries, setEntries] = React.useState<ActivityEntry[] | null>(null);
  const [profiles, setProfiles] = React.useState<UserProfile[]>([]);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([fetchActivity(userId, limit), fetchAccountProfiles(userId)])
      .then(([next, people]) => {
        if (cancelled) return;
        setEntries(next);
        setProfiles(people);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, limit]);

  return (
    <Card className="gap-4 px-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-subheading">Atividades</h2>
        <Link href="/atividades" className="text-body text-electric-blue hover:underline">Ver tudo</Link>
      </div>
      {entries === null ? (
        <p className="text-body text-muted-foreground">Carregando…</p>
      ) : entries.length === 0 ? (
        <p className="text-body text-muted-foreground">Nenhuma atividade ainda.</p>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry, index) => {
            const profile = profiles.find((p) => p.userId === entry.actorId);
            const name = entry.actorId ? profile?.displayName || entry.actorEmail || "Usuário" : "IA";
            const via = entry.actorId ? viaLabel(entry.via) : null;
            return (
              <li key={entry.id} className="flex gap-3">
                <div className="flex w-3 flex-col items-center">
                  <span className={cn("mt-1 size-3 shrink-0 rounded-full", DOT_COLORS[index % DOT_COLORS.length])} />
                  {index < entries.length - 1 ? <span className="my-1 w-0.5 flex-1 bg-ash" /> : null}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5 pb-4">
                  <span className="text-caption text-muted-foreground">{timeFormat.format(new Date(entry.createdAt))}</span>
                  <span className="text-body break-words">
                    <span className="font-medium">{name}</span>{" "}
                    {via ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Bot className="size-3.5" aria-hidden />{via}</span>
                    ) : null}{" "}
                    {describeActivity(entry.action, entry.entity, entry.summary)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
