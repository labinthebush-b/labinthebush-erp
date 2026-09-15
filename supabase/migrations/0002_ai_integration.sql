-- ERP da Marca — infraestrutura de integração com IA (ChatGPT/Claude via MCP/API)
--
-- Duas tabelas novas, nenhuma mexe nas regras financeiras existentes:
--
-- 1. ai_api_keys      — chaves de acesso pessoais que o usuário gera em
--                        Configurações para autenticar um assistente de IA
--                        externo perante a API/MCP do ERP.
-- 2. ai_action_proposals — propostas de lançamento financeiro pendentes de
--                        confirmação (fluxo "preview → confirmar" descrito em
--                        src/lib/ai). Nunca é a IA que persiste direto; ela
--                        só cria uma proposta aqui, e a transação real só é
--                        gravada em `public.transactions` (tabela já
--                        existente, mesmas regras/RLS de sempre) depois que o
--                        usuário confirma.
--
-- RLS fica habilitada nas duas por padrão-de-segurança do projeto, mas a rota
-- de API que atende a IA resolve a chave (hash) e o dono ANTES de saber quem
-- é o usuário, então ela usa a service_role internamente e filtra
-- explicitamente por user_id em toda query (mesmo padrão já usado por
-- scripts/seed-dev-data.ts). RLS aqui é defesa em profundidade para qualquer
-- acesso direto (dashboard, futura leitura client-side), não o único gate.

-- ============================================================================
-- AI API KEYS
-- ============================================================================

create table public.ai_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- SHA-256 da chave real (a chave em si nunca é armazenada nem logada).
  key_hash text not null unique,
  -- Primeiros caracteres da chave, só para o usuário reconhecer qual é qual na UI.
  key_prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index ai_api_keys_user_id_idx on public.ai_api_keys(user_id);

alter table public.ai_api_keys enable row level security;
create policy "ai_api_keys_select_own" on public.ai_api_keys for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_api_keys_insert_own" on public.ai_api_keys for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ai_api_keys_delete_own" on public.ai_api_keys for delete to authenticated using ((select auth.uid()) = user_id);
-- Sem policy de update: uma chave é criada e revogada (deletada), nunca editada.

-- ============================================================================
-- AI ACTION PROPOSALS
-- ============================================================================

create table public.ai_action_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Tipo de operação proposta. Hoje só "transaction" (lançamento financeiro);
  -- o formato já comporta futuras propostas (ex.: "installment_transaction")
  -- sem precisar de nova tabela.
  kind text not null,
  -- Payload já validado e pronto para virar a entidade real (mesmo shape que
  -- src/lib/finance/actions.ts produz), guardado como jsonb para não exigir
  -- uma tabela por tipo de proposta.
  payload jsonb not null,
  -- Texto humano exato que foi mostrado como preview — auditável depois.
  preview_text text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  confirmed_at timestamptz
);
create index ai_action_proposals_user_id_idx on public.ai_action_proposals(user_id);

alter table public.ai_action_proposals enable row level security;
create policy "ai_action_proposals_select_own" on public.ai_action_proposals for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_action_proposals_insert_own" on public.ai_action_proposals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ai_action_proposals_update_own" on public.ai_action_proposals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ai_action_proposals_delete_own" on public.ai_action_proposals for delete to authenticated using ((select auth.uid()) = user_id);
