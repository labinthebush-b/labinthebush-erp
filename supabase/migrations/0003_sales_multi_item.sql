-- Vendas: múltiplos produtos por venda, múltiplos descontos acumulativos e
-- taxa de canal (Nuvemshop).
--
-- `product_id`/`quantity` deixam de ser preenchidos por vendas novas (a partir
-- de agora a lista de itens vive em `items`, jsonb) mas continuam existindo,
-- agora opcionais, só para as vendas já registradas antes desta mudança —
-- src/lib/sales/repository.ts sintetiza um `items` de um item a partir deles
-- na leitura, então nenhuma venda antiga muda de comportamento. O mesmo vale
-- para `discount` (singular, legado) vs. `discounts` (array, novo).
alter table public.sales
  alter column product_id drop not null,
  alter column quantity drop not null,
  add column items jsonb,
  add column discounts jsonb,
  add column nuvemshop_fee_amount integer,
  add column nuvemshop_fee_transaction_id uuid;

-- Taxa do canal Nuvemshop, configurável em Configurações — nunca um valor
-- inventado: fica 0 (sem efeito) até o usuário preencher. Guardada em
-- centésimos de ponto percentual (ex.: 499 = 4,99%) para evitar o tipo
-- `numeric` do Postgres, que o supabase-js devolve como string.
alter table public.settings
  add column nuvemshop_fee_bps integer not null default 0;
