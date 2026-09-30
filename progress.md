# ERP Development Progress

_Atualizado em 2026-09-24 a partir de uma auditoria completa do projeto (branch `dev`, commit `4c07f45`). Nenhum código/banco foi alterado nesta auditoria._

_Segunda atualização, mesmo dia — diagnóstico operacional de preparação do ambiente DEV (branch `dev`, commit `090ae36`). Só leitura: `git fetch` e checagens REST somente-leitura no Supabase. Nenhum código, migration ou dado alterado._

_Décima primeira atualização, 2026-09-29 — **T2.4 concluída**: primeira vez que a Fase 5 do `loop.md` (Tester encontra problema → Developer corrige → Tester reaprova) foi usada de verdade, não só validada em teoria. `src/lib/sales/repository.test.ts` (17 testes) cobre `fetchSales`/`upsertSales` — as únicas funções exportadas do módulo (a lógica de compatibilidade legada é privada, testada através delas). Suíte: 286 → 303. Tester encontrou cobertura insuficiente (não bug): faltavam os casos `quantity: 0` e o formato do `id` sintetizado; provou por mutação independente que eram discriminantes; Developer adicionou os 2 casos; Tester reaprovou. `npm run lint` limpo, `npm run build` ok. Implementação (`lib/sales/repository.ts`) **não** foi alterada em nenhum momento.

Também nesta rodada: `TODO.md` já trazia uma seção 5 nova (T5.1 — módulo de Marketing/GA4/Meta, subtarefas a–f) adicionada pelo usuário fora desta sessão, junto com um `CONTEXTO_MARCA.md` (leitura externa do projeto, não gerado por mim). Segui a ordem estrita do `loop.md` — T5.1 vem depois da seção 2 no backlog e suas subtarefas de código dependem de acesso admin ao GA4/Meta que não foi fornecido — por isso a tarefa desta rodada foi T2.4, não T5.1. Nenhuma subtarefa de T5.1 foi iniciada._

_Décima segunda atualização, mesmo dia — **acesso ao GA4 (T5.1.c) obtido e confirmado**, e **mudança de escopo no módulo de Marketing**. O usuário forneceu a chave da conta de serviço do Google (`erp-ga4-leitor@project-77c9ed61-55da-4a67-b82.iam.gserviceaccount.com`) e o Property ID (`556768654`, depois de eu identificar que o primeiro número passado, `409261497`, era o ID da **conta**, não da **propriedade** — a distinção que causava um 403 PERMISSION_DENIED). Testei o acesso de verdade com uma chamada real à Data API (`runReport`), assinando o JWT do OAuth2 à mão com o `crypto` nativo do Node — nenhuma dependência nova adicionada ao projeto, nenhum script temporário deixado no repositório. Resultado: **200 OK**. Credenciais salvas só em `.env.local` (`GA4_SERVICE_ACCOUNT_EMAIL`/`GA4_SERVICE_ACCOUNT_PRIVATE_KEY`/`GA4_PROJECT_ID`/`GA4_PROPERTY_ID`), nunca commitadas.

Em seguida, o usuário decidiu uma mudança de escopo: a marca não roda anúncios hoje, então a fonte "Meta" deixa de ser a Marketing API (`ads_read`) e passa a ser a **Instagram Graph API** (insights orgânicos — alcance, impressões, engajamento). `TODO.md` reestruturado: o que era T5.1 (GA4+Meta) virou três tarefas — **T5.1** (só GA4, acesso já pronto), **T5.2** (Instagram, nova, sem nenhuma credencial ainda — pré-requisitos: conta profissional, vinculada a uma Página, Página no Business Manager; permissões `instagram_basic`+`instagram_manage_insights`+`pages_read_engagement`+`ads_read`; em aberto se exige App Review da Meta) e **T5.3** (camada de dados + tela "Marketing", combina as duas, bloqueada até T5.1 e T5.2 estarem prontas). Nenhum código alterado nesta atualização — só `.env.local` (local, não commitado) e os dois arquivos de backlog._

_Terceira atualização, mesmo dia — projeto Supabase de DEV criado ("DEV-Lab in the bush", `wyhrsizevngjqbbynkou`) e `.env.local` local reconfigurado para apontar para ele. Produção não foi tocada._

_Quarta atualização, mesmo dia — chaves reais do projeto DEV recebidas e validadas; conexão local com o Supabase DEV confirmada funcionando. Ainda sem nenhuma migration aplicada nele (schema vazio, de propósito)._

_Quinta atualização, mesmo dia — migrations 0001+0002+0003 aplicadas manualmente no DEV (pelo usuário); validação completa do schema real contra o código, e `npm test`/`npm run lint`/`npm run build` rodados. Nenhuma incompatibilidade encontrada._

_Décima atualização, mesmo dia — **T2.2 concluída**: primeira execução completa do `loop.md` (Developer → verificação independente → Tester → aprovada de primeira). Testes novos: `src/lib/ai/proposals.test.ts` (8) + `src/lib/ai/tools/transactions.test.ts` (13) = 21 testes cobrindo o fluxo propose→confirm→cancel de lançamento financeiro via IA, incluindo os 4 critérios pedidos (confirma pendente, cancelada nunca vira transação, expirada não confirma, dupla confirmação não duplica) mais isolamento entre usuários e sugestão de categoria. Suíte: 265 → 286. `npm run lint` limpo, `npm run build` ok. Implementação (`proposals.ts`, `tools/transactions.ts`) **não** foi alterada. Verificado por mutação (própria e independente do Tester): guardas de status/expiração e filtro de `user_id` são realmente detectados se removidos. Achado corrigido durante a implementação: fake de datas usava timestamp fixo já expirado — corrigido para `Date.now()`-relativo. Achado registrado, não bloqueante: `cancelTransaction` numa proposta já confirmada é um no-op correto mas com mensagem de sucesso genérica (clareza, não bug)._

_Nona atualização, mesmo dia — **T4.1 corrigida**: o `last_used_at` de `resolveUserIdFromApiKey` agora é best-effort de verdade. Uma rejeição de promise (falha de transporte) na gravação derrubava a autenticação de uma chave já validada; agora um `try/catch` envolve **apenas** essa gravação. 2 testes novos provam os 4 cenários (UPDATE ok / `{ error }` / promise rejeitada / chave inválida), mais um teste-guarda garantindo que uma falha na **consulta** continua propagando (uma chave não verificada nunca pode virar autenticação ok). Verificado por mutação: o teste novo falha contra a implementação antiga. Suíte 265/265, lint limpo, build ok. Migration 0002 e policies RLS intocadas._

_Oitava atualização, mesmo dia — **revisão de T2.1 pelo agente tester** (`.claude/agents/tester.md`, criado nesta etapa). Teste de mutação confirmou que os 18 testes detectam as 5 quebras centrais (filtros por usuário, guarda de prefixo, gravação de last_used_at, vazamento da chave crua). Nenhum teste decorativo, nenhum bug de isolamento. Encontrou 1 problema real (corrigido na nona atualização), 2 lacunas de cobertura (ordenação de `listApiKeys` e algoritmo de hash não travados por asserção) e 6 pontos de atenção — entre eles: `ai_api_keys` não tem policy de UPDATE (funciona só via service-role), isolamento entre usuários provado só na camada de aplicação (RLS continua pendente em T2.3), e `crypto.subtle` exigir contexto seguro no navegador._

_Sétima atualização, mesmo dia — **T2.1 concluída**: criado o agente `.claude/agents/developer.md` e adicionados 18 testes para `lib/ai/keys.ts` (`src/lib/ai/keys.test.ts`). Suíte: 263/263 (era 245). Lint limpo, build ok. A implementação de `keys.ts` **não** foi alterada. Achado: não existe chave "desativada/expirada" nesta implementação — revogar é apagar a linha (`ai_api_keys` não tem `revoked_at`/`expires_at`/`active`), então os testes cobrem o comportamento real em vez de um conceito inexistente. Primeira tarefa executada com o novo fluxo dev→teste→lint→build→commit; nada foi enviado ao GitHub, `main` e produção intocadas._

_Sexta atualização, mesmo dia — `todo.md` reestruturado como backlog oficial (6 seções: infraestrutura/segurança, testes/qualidade, funcionalidades pendentes de validação, bugs/inconsistências, novas funcionalidades planejadas, melhorias futuras), cada item com objetivo/contexto/critérios/dependências/prioridade. Primeira tarefa executável escolhida: T2.1 (testes para `lib/ai/keys.ts`) — pequena, sem dependência externa, testa o fluxo dev→lint→teste→commit pela primeira vez nesta infraestrutura. Nenhum código alterado._

## Validação schema DEV × código (2026-09-24)

Todas as 16 tabelas esperadas (13 da 0001 + 2 da 0002 + `sale_items` da 0003) existem no DEV, com exatamente as colunas e constraints das migrations — comparei via o schema OpenAPI do PostgREST (somente leitura) contra o TypeScript de cada `repository.ts`, coluna por coluna:

- `products`, `contacts`, `transactions`: 17/12/18 colunas — 100% iguais a `ProductRow`/`ContactRow`/`TransactionRow`.
- `sales`: 21 colunas, incluindo as novas da 0003 (`discounts`, `nuvemshop_fee_amount`, `nuvemshop_fee_transaction_id`); `product_id`/`quantity` confirmados **nullable** (fora da lista `required` do schema) — igual a `SaleRow`.
- `sale_items`: 9 colunas, `product_id`/`quantity`/`unit_price`/`subtotal` confirmados **NOT NULL** — igual a `SaleItemRow` (2 colunas extras no banco, `created_at`/`updated_at`, que o tipo TS não declara porque o código nunca lê essas duas de volta — não é bug, é um `select("*")` com um tipo parcial, mesmo padrão já usado em `ai_action_proposals`).
- `settings`: 8 colunas incluindo `nuvemshop_fee_bps` — igual a `SettingsRow`.
- `ai_api_keys`/`ai_action_proposals`: colunas batem com os `select()` explícitos de `lib/ai/keys.ts`/`proposals.ts`.
- Bucket de Storage `canvas-images` existe e é privado (`public: false`), como a migration 0001 espera.
- **Nenhuma incompatibilidade, bug ou estrutura inesperada encontrada.**

**Limitação honesta**: não consegui confirmar RLS/policies via leitura pura — o teste que realmente prova isolamento por usuário exige inserir uma linha e comparar visibilidade entre duas sessões (o que esta etapa pediu para não fazer, "somente leitura"). O texto da migration é byte-idêntico ao que já foi validado em produção com um usuário de teste descartável (sessão anterior), então a expectativa é a mesma proteção — mas isso ainda não foi reconfirmado ao vivo neste projeto DEV especificamente. Fica pendente para quando um teste de escrita for autorizado.

`npm test`: 245/245 passando (31 arquivos). `npm run lint`: limpo. `npm run build`: sucesso, todas as 12 rotas compiladas. Nenhum código foi alterado.

## Preparação do ambiente — estado atual

- ✅ `main` local sincronizada com `origin/main` (o push pendente da correção de env var já chegou ao GitHub).
- ❌ `dev` continua sem upstream — 5 commits só existem nesta máquina (`git push -u origin dev` ainda bloqueado: `403 denied to Dinossaurkillerjr`, credencial antiga em cache). **Bloqueado por um token/autorização do GitHub.**
- ✅ Projeto Supabase de DEV **criado** ("DEV-Lab in the bush", `https://wyhrsizevngjqbbynkou.supabase.co`).
- ✅ `.env.local` totalmente reconfigurado para o DEV: URL, anon/publishable key e service_role/secret key (formato novo `sb_publishable_.../sb_secret_...`, mesmo padrão já usado em produção). Credenciais de produção antigas preservadas em `.env.local.backup-prod` (gitignored) — nada apagado de forma irreversível. Nomes das variáveis inalterados.
- ✅ **Chaves validadas ao vivo** (checagens somente-leitura): anon key autentica mas não tem privilégio de admin (401 em endpoint admin, como deveria); service_role key autentica e tem privilégio de admin (200 no mesmo endpoint) — as duas chaves estão nos campos certos, nenhuma trocada.
- ✅ **Conexão real com o Supabase DEV confirmada**: `npm run dev` rodado de verdade (porta 3460), `/login` responde 200, `/` redireciona 307, log sem erros (`proxy.ts: 7ms`, sem exceptions) — o app fala com o projeto DEV de ponta a ponta.
- ℹ️ O schema do projeto DEV está **vazio** (nenhuma tabela) — confirmado via `products` retornando 404 (tabela não existe), não 401 (chave inválida). Esperado: nenhuma migration foi aplicada ainda, como pedido.
- ✅ Reconfirmado: produção tem 0001+0002 aplicadas; 0003 não está aplicada em lugar nenhum (nem em produção, nem no DEV — nenhuma migration foi executada nesta etapa).
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

Unit (lógica pura — cálculos, reducers, mapeamento de categorias/heurísticas + autenticação por API key e fluxo propose/confirm/cancel da integração com IA):
PASS — 303/303 (35 arquivos), `tsc` limpo, `eslint` limpo, `next build` ok.

Integration (repository.ts contra banco real ou mockado):
`lib/sales/repository.ts` tem teste desde T2.4 (fake multi-tabela `sales`+`sale_items`) — primeiro repository de domínio do projeto com cobertura. Os demais repositories continuam sem teste próprio.

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
