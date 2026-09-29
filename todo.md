# TODO — Backlog de desenvolvimento

Reestruturado em 2026-09-24 como backlog oficial para uso pelos agentes (branch `dev`). Baseado exclusivamente em `CLAUDE.md`, `progress.md` e no diagnóstico de auditoria já realizado — nenhuma funcionalidade nova foi inventada aqui.

Convenção: cada tarefa tem objetivo, contexto, critérios objetivos de conclusão, dependências e prioridade (Alta/Média/Baixa). `[ ]` pendente, `[x]` concluída.

**T2.1 concluída** → revisada → **T4.1 corrigida** → **T2.2 concluída** → **T2.4 concluída** (2026-09-29, primeira vez que a Fase 5 do `loop.md` foi usada de verdade: Tester achou cobertura insuficiente, Developer corrigiu, Tester reaprovou). Seção 2 fica só com **T2.3** (exige criar/apagar um usuário real no Supabase Auth do DEV — ação com efeito externo, não auto-executada sem aval explícito). T1.1/T1.2/T1.3 seguem bloqueadas por credenciais/decisão sua. **T5.1** (módulo de Marketing, seção 5) tem subtarefas a–f; nenhuma iniciada ainda — T5.1.c/d/e dependem de acesso admin ao GA4/Meta Business Manager que não foi fornecido.

---

## 1. Infraestrutura e segurança

### T1.1 — Publicar a branch `dev` no GitHub
- **Objetivo**: tirar os commits de `dev` de "só existem nesta máquina" e ter backup remoto.
- **Contexto**: `dev` tem 8 commits (auditoria, integração com IA, Vendas multi-produto, estrutura DEV/PROD, migration 0003 relacional, validações de ambiente) nunca enviados ao GitHub. Tentativas de `git push -u origin dev` falharam com `403 denied to Dinossaurkillerjr` (credencial em cache de outra conta, sem permissão neste repositório).
- **Critérios de conclusão**: `git push -u origin dev` bem-sucedido; `git branch -vv` mostra upstream `origin/dev`; `git log origin/dev..dev` vazio.
- **Dependências**: um token do GitHub com permissão de escrita neste repositório (`labinthebush-b/labinthebush-erp`), ou o usuário rodar o push diretamente.
- **Prioridade**: Alta (sem isso, todo o trabalho recente não tem backup).

### T1.2 — Popular o Supabase DEV com dados de exemplo
- **Objetivo**: ter dados realistas no DEV para validar as funcionalidades pendentes (T3.1, T3.2) sem depender de cadastro manual.
- **Contexto**: o schema do DEV já foi validado e está idêntico ao esperado pelo código (ver `progress.md`, quinta atualização). O projeto está vazio (sem linhas). Existe `scripts/seed-dev-data.ts`, já compatível com a estrutura atual (usa `upsertSales`, que já escreve em `sale_items`).
- **Critérios de conclusão**: usuário criado no Supabase Auth do DEV; `npm run seed:dev -- <email>` roda sem erro; dados aparecem ao logar no app local apontando para o DEV.
- **Dependências**: nenhuma — só depende de o usuário existir no DEV (Authentication → Users → Add user) e de rodar o comando.
- **Prioridade**: Alta (bloqueia validação manual das duas funcionalidades pendentes).

### T1.3 — Verificar environment variables do ambiente Preview na Vercel
- **Objetivo**: garantir que um deploy de Preview (disparado por um push em `dev`, uma vez que T1.1 for feita) nunca acesse o Supabase de produção.
- **Contexto**: nunca verificado — as env vars da Vercel foram configuradas em uma sessão anterior, possivelmente sem diferenciar Production de Preview.
- **Critérios de conclusão**: confirmado no dashboard da Vercel (ou via `vercel env ls`) que `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` do ambiente **Preview** apontam para o projeto DEV (`wyhrsizevngjqbbynkou`), nunca para produção.
- **Dependências**: um token da Vercel com acesso ao projeto.
- **Prioridade**: Alta (é o único jeito de um Preview deploy de `dev` não tocar dados reais).

---

## 2. Testes e qualidade

### T2.1 — Testes para `lib/ai/keys.ts` — ✅ CONCLUÍDA (2026-09-24)
- **Objetivo**: cobrir com teste automatizado a geração, hash, verificação e revogação de chaves de API — o código que autentica terceiros perante o ERP.
- **Contexto**: identificado na auditoria como o código de maior risco (autenticação externa) com menor cobertura (zero testes hoje). Funções puras testáveis sem banco real: `hashApiKey`/geração de chave são determinísticas o suficiente para testar por round-trip (gerar → hash → comparar), e `resolveUserIdFromApiKey`/`createApiKey`/`listApiKeys`/`revokeApiKey` podem ser testadas com um client Supabase mockado (mesmo padrão que outros módulos usam para isolar lógica de I/O).
- **Critérios de conclusão**: arquivo `lib/ai/keys.test.ts` criado; cobre no mínimo: uma chave gerada nunca é igual a outra, o hash da mesma chave é sempre igual, uma chave revogada não deveria mais resolver a um usuário; `npm test` passa; `npm run lint` limpo.
- **Resultado**: `src/lib/ai/keys.test.ts` com **18 testes**, cobrindo as 4 funções exportadas (`createApiKey`, `resolveUserIdFromApiKey`, `listApiKeys`, `revokeApiKey`). `npm test` 263/263, `npm run lint` limpo, `npm run build` ok. Implementação **não** foi alterada.
- **Achado registrado**: não existe conceito de chave "desativada"/"expirada" nesta implementação — `ai_api_keys` (migration 0002) não tem `revoked_at`/`expires_at`/`active`; revogar é apagar a linha. Os testes cobrem o comportamento real (revogação = exclusão), sem inventar expiração.
- **Dependências**: nenhuma.
- **Prioridade**: Alta.

### T2.2 — Testes para `lib/ai/proposals.ts` e `lib/ai/tools/transactions.ts` — ✅ CONCLUÍDA (2026-09-24)
- **Objetivo**: cobrir o fluxo propose/confirm/cancel de lançamento financeiro originado pela IA.
- **Contexto**: mesmo motivo do T2.1 — é o código que efetivamente escreve dinheiro no Financeiro a partir de uma fonte externa, hoje sem nenhum teste.
- **Critérios de conclusão**: teste cobre no mínimo: uma proposta pendente pode ser confirmada e vira uma transação real; uma proposta cancelada nunca vira transação; uma proposta expirada não pode mais ser confirmada; confirmar a mesma proposta duas vezes não duplica a transação. `npm test` passa.
- **Resultado**: `src/lib/ai/proposals.test.ts` (8 testes — CRUD da proposta, isolamento por usuário) + `src/lib/ai/tools/transactions.test.ts` (13 testes — propose/confirm/cancel usando `proposals.ts` real, não mockado, com um fake de client multi-tabela cobrindo `ai_action_proposals`/`custom_categories`/`transactions`). Os 4 critérios pedidos estão cobertos, mais: sugestão de categoria, rejeição de `amount`/`description` inválidos, isolamento entre usuários na cadeia propose→confirm, `dueDate` vencido vs. futuro. Implementação **não** foi alterada.
- **Revisão do Tester**: **aprovada**. Verificação independente por mutação: removendo as guardas de status/expiração de `confirmTransaction`, 3 testes falham; removendo o filtro de `user_id` em `getOwnProposal`, 2 testes falham (um em cada arquivo). Achado durante a implementação: o fake de datas usava timestamps fixos de 2026-01-01, já no passado em relação ao relógio real — corrigido para gerar `created_at`/`expires_at` relativos a `Date.now()`.
- **Ponto de atenção registrado (não bloqueante)**: `cancelTransaction` numa proposta **já confirmada** é um no-op correto (não desfaz a transação, não sobrescreve o status), mas devolve a mesma mensagem de sucesso ("Proposta cancelada. Nada foi registrado.") de um cancelamento real — pode confundir quem lê a resposta sem saber que era um no-op. Não é um bug de dados/segurança, é clareza de mensagem; não corrigido nesta tarefa (fora do escopo de "adicionar testes").
- **Dependências**: nenhuma.
- **Prioridade**: Alta.

### T2.3 — Verificar RLS/policies ao vivo no Supabase DEV
- **Objetivo**: confirmar, com um teste real (não só leitura de schema), que as policies aplicadas pelas migrations 0001–0003 realmente isolam dados por usuário no projeto DEV.
- **Contexto**: a validação de schema já confirmada (ver `progress.md`) comparou apenas estrutura de tabelas/colunas — não conseguiu confirmar RLS via leitura pura, porque isso exige inserir uma linha e comparar visibilidade entre duas sessões. O texto da migration é idêntico ao já validado com um usuário de teste descartável em produção, mas isso nunca foi reconfirmado ao vivo neste projeto DEV especificamente.
- **Critérios de conclusão**: criar um usuário de teste descartável, inserir uma linha como esse usuário, confirmar que uma segunda sessão/usuário não a enxerga, confirmar que o próprio usuário a enxerga, depois apagar o usuário de teste (o cascade já limpa os dados). Resultado documentado em `progress.md`.
- **Dependências**: T1.2 não é estritamente necessária, mas é mais simples fazer isso já com o banco populado.
- **Prioridade**: Média (a expectativa de que funciona é alta, mas é a única lacuna de segurança ainda não fechada).

### T2.4 — Teste de repository para a lógica de compatibilidade legada em Vendas — ✅ CONCLUÍDA (2026-09-29)
- **Objetivo**: cobrir com teste a lógica que sintetiza itens/descontos de vendas antigas (`legacyRowToItems`/`legacyRowToDiscounts` em `lib/sales/repository.ts`).
- **Contexto**: nenhum `repository.ts` do projeto tem teste próprio hoje. Essa lógica específica é a mais arriscada de todas: decide como uma venda antiga (uma coluna `product_id`/`quantity`) é lida como se fosse uma venda nova (lista de itens) — um erro aqui faria vendas antigas mudarem de comportamento silenciosamente.
- **Critérios de conclusão**: teste cobre no mínimo: uma linha com `product_id`/`quantity`/`subtotal` legados (sem linhas em `sale_items`) gera exatamente um item com esses valores; uma linha com linhas em `sale_items` ignora as colunas legadas; uma linha com `discount` singular (legado) vira um array de um elemento; uma linha com `discounts` (array, novo) é usada como está. `npm test` passa.
- **Resultado**: `src/lib/sales/repository.test.ts` com **17 testes**, exercitando `fetchSales`/`upsertSales` (as únicas funções exportadas — `legacyRowToItems`/`legacyRowToDiscounts`/`rowToSale`/`saleToRow` são privadas ao módulo) contra um fake de client cobrindo `sales` + `sale_items`. Os 4 critérios pedidos cobertos, mais: `unitPrice` legado com divisão não exata, venda sem `subtotal`/`quantity`, agrupamento correto de itens quando há múltiplas vendas, `upsertSales` nunca escreve nas colunas legadas e substitui os itens por completo ao editar (sem duplicar). Implementação **não** foi alterada.
- **Revisão do Tester**: **aprovada** — mas só na segunda passagem (Fase 5 acionada uma vez). Primeira revisão encontrou **cobertura insuficiente** (não um bug): faltava o caso `quantity: 0` (diferente de `null`/`undefined` para o `??` do código; a implementação já trata isso corretamente, só não estava coberto) e o formato exato do `id` sintetizado (`<id-da-venda>-item-legado`). Provado por mutação independente do Tester que os dois casos são discriminantes. Developer adicionou os 2 testes ao arquivo oficial (17 no total); Tester reaprovou.
- **Dependências**: nenhuma.
- **Prioridade**: Média.

---

## 3. Funcionalidades parcialmente implementadas que precisam de validação

### T3.1 — Validar Vendas multi-produto contra o Supabase DEV
- **Objetivo**: primeira verificação real (não só lógica em memória) de múltiplos produtos por venda, descontos acumulativos e taxa Nuvemshop.
- **Contexto**: código completo, 245 testes de lógica pura passando, schema já validado (T do diagnóstico anterior), mas nunca exercitado de ponta a ponta contra um banco de verdade — nem criação, nem edição, nem exclusão.
- **Critérios de conclusão** (via UI local, apontando para o DEV): criar uma venda com 2+ produtos e conferir que `sale_items` recebe as linhas certas; editar quantidade/preço de um item e conferir recálculo; aplicar 2 descontos acumulados (ex.: percentual + valor fixo) e conferir o total; usar canal Nuvemshop com a taxa configurada em Configurações e conferir que a despesa de taxa aparece no Financeiro; excluir a venda e conferir que `sale_items` e as transações vinculadas (receita, frete, taxa) somem junto.
- **Dependências**: T1.2 (dados de exemplo facilitam, mas não são obrigatórios — pode ser testado com um produto cadastrado manualmente).
- **Prioridade**: Alta.

### T3.2 — Validar a integração com IA (MCP) ponta a ponta
- **Objetivo**: primeira verificação real do fluxo consulta + propose/confirm de lançamento via `/api/mcp`.
- **Contexto**: código completo (endpoint, chaves de API, ferramentas de consulta e de lançamento), migration aplicada, mas nunca testado com uma chave de API real gerada pela UI.
- **Critérios de conclusão**: gerar uma chave em Configurações → Integração com IA (apontando para o DEV); chamar `/api/mcp` com essa chave; rodar uma consulta (`get_caixa` ou similar) e conferir resposta coerente com os dados do DEV; propor um lançamento (`propose_transaction`) e confirmar (`confirm_transaction`); conferir que a transação aparece no Financeiro exatamente como o preview prometeu.
- **Dependências**: T1.2 recomendado (para ter caixa/transações pré-existentes e comparar).
- **Prioridade**: Alta.

---

## 4. Bugs ou inconsistências

### T4.1 — `last_used_at` podia derrubar uma autenticação já válida — ✅ CORRIGIDA (2026-09-24)
- **Objetivo**: garantir que uma falha ao gravar `last_used_at` nunca impeça a autenticação de uma API key que já foi validada.
- **Contexto**: encontrado pela revisão do agente tester em T2.1. O comentário em `resolveUserIdFromApiKey` afirmava que a gravação é best-effort e *"must never block the actual request"*, mas isso só valia para o `{ error }` do PostgREST (ignorado por não ser checado). Uma **rejeição da promise** (falha de transporte) propagava e derrubava a autenticação — reproduzido pelo tester.
- **Critérios de conclusão**: os 4 cenários provados por teste (UPDATE ok / UPDATE com `{ error }` / UPDATE rejeitando / chave inválida); `npm test`, `npm run lint` e `npm run build` passando.
- **Resultado**: `try/catch` em volta **apenas** da gravação de `last_used_at` (11 linhas, sem alterar mais nada). 2 testes novos (total do arquivo: 18 → 20; suíte: 263 → 265). Verificado por mutação: o teste novo **falha** contra a implementação antiga com `Error: falha de transporte simulada no update`, e passa com a correção. Migration 0002 e policies RLS não foram tocadas.
- **Prioridade**: era Alta (segurança/disponibilidade da autenticação).

Fora isso, nenhum bug de cálculo/lógica foi encontrado em nenhuma auditoria até agora. Dois pontos foram registrados como **observação arquitetural, não bug** (não bloqueiam nada, não estão quebrados) — mantidos aqui só para rastreabilidade, com a mesma classificação já dada quando foram encontrados:

- **`sale_items.product_id`/`sales.product_id` não verificam posse do produto pelo usuário, só existência da linha** (FK padrão do Postgres) — assim desde a Fase 3, não introduzido agora, não explorável pela UI atual (o navegador só envia IDs de produtos do próprio usuário). Só relevante se um dia uma API externa aceitar IDs arbitrários vindos do cliente.
- **`upsertSales` apaga e reinsere os itens de uma venda em duas chamadas separadas**, não uma transação de banco única — uma falha de rede exatamente entre as duas chamadas deixaria a venda com zero itens até a próxima sincronização. Risco baixo (uso single-user, poucas edições).

Nenhuma ação necessária agora — revisitar apenas se o projeto crescer para múltiplos usuários simultâneos ou ganhar uma API que aceite IDs de produto vindos de fora.

---

## 5. Novas funcionalidades já planejadas para o ERP

Até 2026-09-29 esta seção estava vazia de propósito (nada além das seções 1–3 estava documentado em `CLAUDE.md`, `progress.md` ou nos docs de fase). A partir daqui, entra o que o usuário pediu explicitamente. Todos os núcleos de `CLAUDE.md` (Caixa, DRE, Vendas, Produtos, Cupons, Taxas da Nuvemshop, Dashboard etc.) já têm implementação; os itens pendentes de validação seguem na seção 3.

### T5.1 — Módulo de Marketing: integrar Google Analytics (GA4) e Meta Business Manager ao ERP
- **Objetivo**: trazer para dentro do ERP os números de marketing (tráfego, campanhas, gasto com anúncios) e cruzá-los com as vendas e o financeiro que o ERP já tem, para responder "quanto gastei para gerar esta venda" (CAC, ROAS, margem depois do gasto com anúncios).
- **Contexto**: hoje o ERP conhece vendas por canal (incl. Nuvemshop) e despesas, mas não sabe de onde veio o cliente nem quanto foi gasto em anúncios. As duas fontes são APIs oficiais e documentadas: **Google Analytics Data API (GA4)** e **Meta Marketing API / Insights API** (via Business Manager, hoje "Business Portfolio"). A abordagem segue o padrão documentado por Google e Meta (plano de mensuração, convenção de UTM, dedupe Pixel + Conversions API); nada aqui foi reaproveitado de outro projeto. Pontos que dependem de decisão do usuário estão marcados como **[DECIDIR]**.
- **Subtarefas** (executar em ordem; cada uma com commit próprio na branch `dev`):
  - [ ] **T5.1.a — Plano de mensuração e convenção de UTM** (documento, sem código). Definir: quais eventos importam (GA4: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, marcados como *key events*), padrão único de `utm_source` / `utm_medium` / `utm_campaign` / `utm_content` (minúsculas, sem espaço) e onde cada campanha da marca aponta. Sem isso, os dados chegam sujos e o cruzamento com vendas não funciona.
  - [ ] **T5.1.b — Confirmar a instrumentação da loja (Nuvemshop)**. Verificar que GA4 (ID de métrica `G-…`) e Pixel da Meta estão instalados e disparando `purchase` na loja; a Nuvemshop tem integração nativa para ambos. Checar no GA4 DebugView e no Meta Events Manager (Test Events). **[DECIDIR]** se ativa também a **Conversions API** da Meta (envio server-side com deduplicação por `event_id`), que recupera conversões perdidas por bloqueadores/iOS.
  - [ ] **T5.1.c — Acesso somente leitura às APIs**. GA4: service account com papel *Viewer* na propriedade + Google Analytics Data API ativada. Meta: usuário de sistema no Business Manager com permissão `ads_read` apenas (nunca `ads_management` nesta fase). Tokens em variáveis de ambiente do servidor (nunca no client nem no repositório), separados entre DEV e PROD, seguindo o mesmo cuidado das env vars do Supabase (ver T1.3).
  - [ ] **T5.1.d — Camada de dados**. Nova migration (0004) com tabelas de métricas diárias por fonte/campanha (ex.: `marketing_daily_metrics`), com `user_id` e RLS igual às demais tabelas; job/rota de sincronização idempotente (upsert por dia + campanha) para não duplicar em re-execuções.
  - [ ] **T5.1.e — Tela "Marketing" no ERP**. Cards e gráficos: sessões e conversões (GA4), gasto, alcance, cliques e CPC por campanha (Meta), e as métricas derivadas **CAC**, **ROAS** e **gasto com anúncios como % da receita**. Regra de negócio: o gasto de anúncios pode ser lançado no Financeiro como despesa de Marketing **[DECIDIR]**: automático ou só conferência manual, para não duplicar lançamentos.
  - [ ] **T5.1.f — Testes**. Funções puras (cálculo de CAC/ROAS, normalização de UTM, mapeamento de campanha → venda) com testes unitários, no mesmo padrão dos demais módulos; clients GA4/Meta mockados como nos testes de `lib/ai/`.
- **Critérios de conclusão**: sincronização roda no DEV sem erro e sem duplicar; números da tela batem com o GA4 e com o Gerenciador de Anúncios da Meta para o mesmo período (conferência manual em 2–3 datas); `npm test`, `npm run lint` e `npm run build` passando; resultado documentado em `progress.md`.
- **Conformidade**: LGPD. O ERP só consome métricas agregadas, não dados pessoais de visitantes; o banner de consentimento de cookies da loja continua sendo responsabilidade da Nuvemshop/loja.
- **Dependências**: acesso de administrador às propriedades GA4 e ao Business Manager da marca (credenciais do usuário); T1.2 (dados de exemplo no DEV) facilita a validação das vendas cruzadas.
- **Prioridade**: Média (não bloqueia nada existente; T5.1.a e T5.1.b não exigem código e podem começar já).

---

## 6. Melhorias futuras

Ideias e observações já registradas em auditorias anteriores ou explicitamente adiadas pelo próprio usuário — nenhuma delas deve ser iniciada sem pedido explícito.

- **README.md** ainda é o boilerplate padrão do `create-next-app` — não descreve o projeto real. Baixa prioridade, não bloqueia nada.
- **Docs `00_PHASE_1` a `06_PHASE_6`** são o planejamento pré-deploy, hoje só históricos — poderiam ser marcados como arquivados para não confundir com `progress.md`/`todo.md` (fonte de verdade atual). Baixa prioridade.
- **Aviso do `vitest.config.ts`** sobre ESM/CommonJS no carregamento de config — cosmético, não afeta os testes. Baixa prioridade.
- **OAuth para a integração com IA** (em vez de chave de API estática) — explicitamente definido como "Fase 1" na especificação original da integração com IA; melhoria de fase futura, não pedida ainda.
- **Lançamentos parcelados/recorrentes via IA** — a integração com IA hoje só propõe lançamentos avulsos; parcelamento/recorrência via IA foi explicitamente definido como fora do escopo da primeira fase.
- **FK de posse de produto e atomicidade de `upsertSales`** (ver seção 4) — só revisitar se o contexto de uso mudar (múltiplos usuários, API externa aceitando IDs de fora).

---

## Primeira tarefa executável

**T2.1 — Testes para `lib/ai/keys.ts`.**

Por quê essa e não outra:
- É pequena e autocontida: um arquivo de teste novo, sem depender de banco real, sem depender de nenhuma outra tarefa pendente (T1.1, T1.2, T1.3 continuam bloqueadas por credenciais externas).
- Exercita o fluxo completo que `CLAUDE.md`/`loop.md` descrevem (entender código existente → implementar → lint → teste → commit → atualizar `progress.md`) sem nenhum risco: não toca banco, não faz push, não altera `main`.
- Ataca diretamente o maior risco identificado na auditoria (autenticação de terceiros sem nenhuma cobertura), então mesmo sendo pequena já reduz uma lacuna real, não é trabalho descartável.
- Tem critério de conclusão binário e rápido de checar (`npm test` verde), ideal para validar o fluxo antes de tarefas maiores.