# ERP Development Progress

_Atualizado em 2026-09-24 a partir de uma auditoria completa do projeto (branch `dev`, commit `4c07f45`). Nenhum código/banco foi alterado nesta auditoria._

_Segunda atualização, mesmo dia — diagnóstico operacional de preparação do ambiente DEV (branch `dev`, commit `090ae36`). Só leitura: `git fetch` e checagens REST somente-leitura no Supabase. Nenhum código, migration ou dado alterado._

_Terceira atualização, mesmo dia — projeto Supabase de DEV criado ("DEV-Lab in the bush", `wyhrsizevngjqbbynkou`) e `.env.local` local reconfigurado para apontar para ele. Produção não foi tocada._

## Preparação do ambiente — estado atual

- ✅ `main` local sincronizada com `origin/main` (o push pendente da correção de env var já chegou ao GitHub).
- ❌ `dev` continua sem upstream — 5 commits só existem nesta máquina (`git push -u origin dev` ainda bloqueado: `403 denied to Dinossaurkillerjr`, credencial antiga em cache). **Bloqueado por um token/autorização do GitHub.**
- ✅ Projeto Supabase de DEV **criado** ("DEV-Lab in the bush", `https://wyhrsizevngjqbbynkou.supabase.co`) — confirmado ao vivo que responde (401 sem key, como esperado para um projeto que existe).
- ✅ `.env.local` reconfigurado para apontar para o DEV: `NEXT_PUBLIC_SUPABASE_URL` trocado para a URL do projeto novo. As credenciais de produção antigas foram salvas em `.env.local.backup-prod` (gitignored, não commitado) antes da troca — nada foi apagado de forma irreversível.
- ⏸️ `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` do projeto DEV ainda são placeholders (`PENDENTE-...`) — **bloqueado por você me passar essas duas chaves** (Project Settings → API no dashboard do projeto DEV). Nenhum valor foi inventado.
- ✅ Verificado: `npm run dev` inicia normalmente com essa configuração (testado na porta 3458 — `/login` responde 200, `/` redireciona 307 como esperado). A ausência das duas chaves não trava o app: cai sempre no estado "não autenticado", nunca tenta nem consegue falar com produção (a URL nem é mais a de produção).
- ❌ Conexão real com o Supabase DEV ainda **não funciona** — só vai funcionar depois que as duas chaves pendentes forem preenchidas.
- ✅ Reconfirmado: produção tem 0001+0002 aplicadas; 0003 não está aplicada em lugar nenhum (nem em produção, nem no DEV ainda — nenhuma migration foi executada nesta etapa).
- ℹ️ Não existe `supabase/config.toml` — projeto nunca foi `supabase link`ado; migrations em produção foram coladas manualmente no SQL Editor. Mesmo método planejado para o DEV.
- ✅ As 4 env vars reais do app (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_ENV`) continuam com os mesmos nomes — nenhuma renomeação feita nesta etapa, como pedido.
- ⏸️ Environment variables do ambiente Preview da Vercel — ainda não verificadas (depende de um token da Vercel, não pedido nesta etapa).

## Current phase

Pós-Fase 6 (deploy já aprovado e feito em produção) — expansão pós-deploy: Integração com IA + Vendas multi-produto, desenvolvidas na branch `dev`, aguardando ambiente de DEV utilizável antes de qualquer teste real ou promoção para `main`.

## Current objective

Destravar o ambiente DEV (repositório remoto sincronizado + Supabase de DEV) e então validar de verdade (contra banco real) o que hoje só tem teste de lógica em memória: Vendas multi-produto e a integração com IA.

## Completed (em produção / `main`)

- [x] Dashboard
- [x] Financeiro (transações, categorias, parcelamento, recorrência, fechamento mensal, histórico de edição)
- [x] Produtos (catálogo, custo, simulação de margem)
- [x] Vendas (versão de um produto por venda, cupom único, frete)
- [x] Contatos (CRM + pipeline)
- [x] Tarefas (kanban/lista, filtros, notificações)
- [x] Canvas (Supabase Storage)
- [x] Configurações
- [x] Relatórios (financeiro, produtos, vendas, contatos)
- [x] Planejamento (aportes/reservas, orçamento por categoria)
- [x] Backup (export JSON)
- [x] Autenticação (Supabase Auth) + RLS
- [x] Deploy em produção (Vercel) — https://labinthebush-erp-5kgm.vercel.app

## In progress (só em `dev`, não mesclado)

- [ ] Vendas: múltiplos produtos por venda, descontos acumulativos, taxa Nuvemshop — código completo e testado (lógica pura), mas a migration 0003 (`sale_items`) nunca foi aplicada em nenhum banco. **Sem nenhuma verificação contra um banco real ainda.**
- [ ] Integração com IA via MCP (`/api/mcp`) — consulta + propose/confirm de lançamento. Migration 0002 já aplicada em produção (tabelas existem, código não). **Nunca testada ponta-a-ponta com uma chave de API real.**
- [ ] Estrutura DEV/PROD (branches, selo de ambiente, `ENVIRONMENTS.md`) — pronta em `dev`, mas o Supabase de DEV combinado ainda não foi criado.

## Known bugs

Nenhum bug de cálculo/lógica encontrado. Riscos operacionais reais:

- [ ] `dev` nunca foi enviada ao GitHub (sem upstream) — 4 commits só existem localmente, sem backup remoto.
- [ ] `main` local está 1 commit à frente de `origin/main` (correção de env var já publicada via Vercel CLI, nunca enviada ao Git).
- [ ] `.env.local` ainda aponta para o Supabase de **produção** — não há Supabase de DEV configurado.
- [ ] `lib/ai/keys.ts`, `lib/ai/proposals.ts`, `lib/ai/tools/*` (autenticação por chave + escrita de lançamento financeiro) sem nenhum teste — maior risco, menor cobertura do projeto.
- [ ] Nenhum repository.ts (de nenhum módulo) tem teste próprio — a lógica de compatibilidade legada (`legacyRowToItems`/`legacyRowToDiscounts`) está sem cobertura.
- [ ] `README.md` é o boilerplate padrão do `create-next-app`, não descreve o projeto real.

## Pending

- [ ] Criar o projeto Supabase de DEV e aplicar as migrations 0001–0003 nele.
- [ ] Enviar `dev` para o GitHub; sincronizar `main` com `origin/main`.
- [ ] Verificar/ajustar as environment variables do ambiente Preview da Vercel para nunca apontarem para o Supabase de produção.
- [ ] Testar Vendas multi-produto e a integração de IA contra o Supabase de DEV.
- [ ] Adicionar testes para `lib/ai/keys.ts`/`proposals.ts`/`tools/*` e ao menos um teste de repository.
- [ ] Só depois disso: aprovação explícita → merge `dev` → `main` → deploy.

## Tests

Unit (lógica pura — cálculos, reducers, mapeamento de categorias/heurísticas):
PASS — 245/245 (31 arquivos), `tsc` limpo, `eslint` limpo, `next build` ok.

Integration (repository.ts contra banco real ou mockado):
NÃO EXISTE — nenhum repository tem teste.

E2E:
NÃO EXISTE — nenhuma ferramenta (Playwright/Cypress) configurada.

## Last changes

- `4c07f45` Migration 0003: sale_items relacional em vez de items jsonb (branch `dev`)
- `c48a1d4` Estrutura DEV/PROD: branch dev, selo de ambiente, .env.local.example versionado
- `58aa13e` Vendas: múltiplos produtos por venda, descontos acumulativos e taxa Nuvemshop
- `dfb4dac` Integração com IA (ChatGPT/Claude) via MCP — consulta + lançamento com confirmação
- `2beb893` (main, produção) Corrige env vars ausentes no bundle do cliente em produção

## Next action

Ver `todo.md` — a ordem recomendada começa por destravar o ambiente (push de `dev`, sync de `main`, criação do Supabase de DEV) antes de qualquer novo código.
