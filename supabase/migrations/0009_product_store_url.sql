-- Produtos: link da página do produto na loja (Nuvemshop).
-- O cadastro de produto puxa nome, preço, foto, descrição, coleção e
-- tamanhos a partir desse link (ver src/lib/catalog/store-import.ts); o link
-- fica guardado para "Ver na loja" e para atualizar os dados depois.
-- Coluna nova e opcional: nenhum dado existente muda. As políticas de RLS da
-- tabela já cobrem a coluna.

alter table public.products add column if not exists store_url text;
