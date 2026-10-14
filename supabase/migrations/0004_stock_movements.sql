-- Estoque por tamanho e cor.
--
-- O estoque não é um número guardado: é a SOMA das movimentações
-- (`stock_movements`) de cada variante — a dupla (tamanho, cor) de um produto,
-- tirada de products.sizes / products.colors. Mesmo molde de Venda ->
-- Transação: cada item de venda gera a sua movimentação de saída, e editar ou
-- excluir a venda atualiza ou remove essa movimentação (feito no app, em
-- lib/stock). Assim nunca existe um "saldo" que possa divergir do histórico.
--
-- Sem FK em `sale_id`/`sale_item_id` (só uuid solto), pelo mesmo motivo de
-- sales.transaction_id: vendas e movimentações são sincronizadas em paralelo
-- por providers diferentes, então uma FK poderia ser violada só pela ordem de
-- chegada das requisições. `product_id` tem FK (o produto sempre existe antes
-- de ter estoque) e `on delete cascade`: apagar um produto apaga o histórico
-- de estoque dele (um produto vendido já não pode ser apagado — ver
-- sale_items.product_id, `on delete restrict`).

create table public.stock_movements (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  -- Nulos quando o produto não tem tamanho/cor (uma única variante).
  size text,
  color text,
  -- Com sinal: positivo entra no estoque, negativo sai. Nunca zero.
  quantity integer not null,
  kind text not null,
  date date not null,
  note text,
  -- Preenchidos só nas saídas geradas por uma venda.
  sale_id uuid,
  sale_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_movements_kind_check check (kind in ('entrada', 'saida', 'ajuste')),
  constraint stock_movements_quantity_nonzero check (quantity <> 0)
);
create index stock_movements_user_id_idx on public.stock_movements(user_id);
create index stock_movements_product_id_idx on public.stock_movements(product_id);
create index stock_movements_sale_id_idx on public.stock_movements(sale_id);

alter table public.stock_movements enable row level security;
create policy "stock_movements_select_own" on public.stock_movements for select to authenticated using ((select auth.uid()) = user_id);
create policy "stock_movements_insert_own" on public.stock_movements for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "stock_movements_update_own" on public.stock_movements for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "stock_movements_delete_own" on public.stock_movements for delete to authenticated using ((select auth.uid()) = user_id);

-- Qual tamanho/cor foi vendido em cada item (nulos para produtos sem variação
-- e para toda venda registrada antes desta migration).
alter table public.sale_items
  add column size text,
  add column color text;

-- Abaixo (ou igual a) este número de peças, a variante aparece como
-- "estoque baixo". Configurável em Configurações.
alter table public.settings
  add column low_stock_threshold integer not null default 3;
