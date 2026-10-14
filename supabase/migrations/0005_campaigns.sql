-- Marketing — etapa 1: registro de campanhas (ver PLANO_MARKETING_ATRIBUICAO.md).
--
-- Uma campanha guarda a UTM que identifica o tráfego dela (utm_campaign único
-- por usuário: é a chave que liga visitas do GA4, e nas próximas etapas vendas,
-- contatos e cupons, a esta campanha).
--
-- instagram_posts guarda só o que o ERP sabe sobre um post e o Instagram não:
-- a campanha a que ele pertence e as tags (etapa 5). Métricas do post são
-- lidas ao vivo da Instagram Graph API, nunca copiadas para cá.

create table public.campaigns (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  channel text not null,
  start_date date not null,
  end_date date,
  -- Centavos. Opcional: campanha orgânica não tem custo.
  cost integer,
  notes text,
  utm_source text not null,
  utm_medium text not null,
  utm_campaign text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_channel_check check (channel in ('instagram', 'site', 'dm', 'outro')),
  constraint campaigns_cost_check check (cost is null or cost >= 0),
  constraint campaigns_dates_check check (end_date is null or end_date >= start_date),
  constraint campaigns_utm_campaign_unique unique (user_id, utm_campaign)
);
create index campaigns_user_id_idx on public.campaigns(user_id);

alter table public.campaigns enable row level security;
create policy "campaigns_select_own" on public.campaigns for select to authenticated using ((select auth.uid()) = user_id);
create policy "campaigns_insert_own" on public.campaigns for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "campaigns_update_own" on public.campaigns for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "campaigns_delete_own" on public.campaigns for delete to authenticated using ((select auth.uid()) = user_id);

-- Sem FK para campaigns pelo mesmo motivo de sales.transaction_id: as duas
-- tabelas sincronizam em paralelo; apagar a campanha desliga os posts no app.
create table public.instagram_posts (
  -- Id do post na Instagram Graph API (texto, não uuid).
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index instagram_posts_campaign_id_idx on public.instagram_posts(campaign_id);

alter table public.instagram_posts enable row level security;
create policy "instagram_posts_select_own" on public.instagram_posts for select to authenticated using ((select auth.uid()) = user_id);
create policy "instagram_posts_insert_own" on public.instagram_posts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "instagram_posts_update_own" on public.instagram_posts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "instagram_posts_delete_own" on public.instagram_posts for delete to authenticated using ((select auth.uid()) = user_id);
