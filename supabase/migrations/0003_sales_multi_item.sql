-- Vendas: múltiplos produtos por venda, múltiplos descontos acumulativos e
-- taxa de canal (Nuvemshop).
--
-- `product_id`/`quantity` em `sales` deixam de ser preenchidos por vendas
-- novas (a partir de agora cada produto de uma venda é uma linha em
-- `sale_items`) mas continuam existindo, agora opcionais, só para as vendas
-- já registradas antes desta mudança — src/lib/sales/repository.ts sintetiza
-- um item a partir deles na leitura quando não há linhas em `sale_items`,
-- então nenhuma venda antiga muda de comportamento. O mesmo vale para
-- `discount` (singular, legado) vs. `discounts` (array, novo).
--
-- `sale_items` é uma tabela própria (não jsonb) de propósito: mantém a FK
-- para `products` (com o mesmo `on delete restrict` que a coluna legada
-- `product_id` já tinha — um produto vendido continua não podendo ser
-- apagado), e deixa qualquer relatório/futura integração de estoque/CMV
-- fazer join e agregar em SQL em vez de trazer todas as vendas para
-- recalcular em JS. `discounts` continua jsonb — é pequeno, não precisa de
-- integridade referencial nem de índice por item, e é lido sempre por
-- inteiro junto da venda.
alter table public.sales
  alter column product_id drop not null,
  alter column quantity drop not null,
  add column discounts jsonb,
  add column nuvemshop_fee_amount integer,
  add column nuvemshop_fee_transaction_id uuid;

create table public.sale_items (
  id uuid primary key,
  sale_id uuid not null references public.sales(id) on delete cascade,
  -- Denormalizado a partir de sales.user_id: cada policy de RLS abaixo
  -- compara direto contra esta coluna (mesmo padrão de toda outra tabela do
  -- schema), em vez de precisar de uma subquery em `sales` para descobrir o
  -- dono a cada linha.
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null,
  unit_price integer not null,
  subtotal integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sale_items_sale_id_idx on public.sale_items(sale_id);
create index sale_items_user_id_idx on public.sale_items(user_id);
create index sale_items_product_id_idx on public.sale_items(product_id);

alter table public.sale_items enable row level security;
create policy "sale_items_select_own" on public.sale_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "sale_items_insert_own" on public.sale_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sale_items_update_own" on public.sale_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "sale_items_delete_own" on public.sale_items for delete to authenticated using ((select auth.uid()) = user_id);

-- Taxa do canal Nuvemshop, configurável em Configurações — nunca um valor
-- inventado: fica 0 (sem efeito) até o usuário preencher. Guardada em
-- centésimos de ponto percentual (ex.: 499 = 4,99%) para evitar o tipo
-- `numeric` do Postgres, que o supabase-js devolve como string.
alter table public.settings
  add column nuvemshop_fee_bps integer not null default 0;
