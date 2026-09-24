# TODO — Backlog de desenvolvimento

Reestruturado em 2026-09-24 como backlog oficial para uso pelos agentes (branch `dev`). Baseado exclusivamente em `CLAUDE.md`, `progress.md` e no diagnóstico de auditoria já realizado — nenhuma funcionalidade nova foi inventada aqui.

Convenção: cada tarefa tem objetivo, contexto, critérios objetivos de conclusão, dependências e prioridade (Alta/Média/Baixa). `[ ]` pendente, `[x]` concluída.

**T2.1 concluída** (2026-09-24, primeira tarefa com o novo fluxo) → **revisada pelo agente tester** → **T4.1 corrigida** (bug que a revisão encontrou). Próxima recomendada: **T2.4** ou **T2.2** (sem dependência externa); T1.1/T1.2/T1.3 seguem bloqueadas por credenciais/ações suas.

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

### T2.2 — Testes para `lib/ai/proposals.ts` e `lib/ai/tools/transactions.ts`
- **Objetivo**: cobrir o fluxo propose/confirm/cancel de lançamento financeiro originado pela IA.
- **Contexto**: mesmo motivo do T2.1 — é o código que efetivamente escreve dinheiro no Financeiro a partir de uma fonte externa, hoje sem nenhum teste.
- **Critérios de conclusão**: teste cobre no mínimo: uma proposta pendente pode ser confirmada e vira uma transação real; uma proposta cancelada nunca vira transação; uma proposta expirada não pode mais ser confirmada; confirmar a mesma proposta duas vezes não duplica a transação. `npm test` passa.
- **Dependências**: nenhuma (pode reaproveitar o padrão de mock de T2.1).
- **Prioridade**: Alta.

### T2.3 — Verificar RLS/policies ao vivo no Supabase DEV
- **Objetivo**: confirmar, com um teste real (não só leitura de schema), que as policies aplicadas pelas migrations 0001–0003 realmente isolam dados por usuário no projeto DEV.
- **Contexto**: a validação de schema já confirmada (ver `progress.md`) comparou apenas estrutura de tabelas/colunas — não conseguiu confirmar RLS via leitura pura, porque isso exige inserir uma linha e comparar visibilidade entre duas sessões. O texto da migration é idêntico ao já validado com um usuário de teste descartável em produção, mas isso nunca foi reconfirmado ao vivo neste projeto DEV especificamente.
- **Critérios de conclusão**: criar um usuário de teste descartável, inserir uma linha como esse usuário, confirmar que uma segunda sessão/usuário não a enxerga, confirmar que o próprio usuário a enxerga, depois apagar o usuário de teste (o cascade já limpa os dados). Resultado documentado em `progress.md`.
- **Dependências**: T1.2 não é estritamente necessária, mas é mais simples fazer isso já com o banco populado.
- **Prioridade**: Média (a expectativa de que funciona é alta, mas é a única lacuna de segurança ainda não fechada).

### T2.4 — Teste de repository para a lógica de compatibilidade legada em Vendas
- **Objetivo**: cobrir com teste a lógica que sintetiza itens/descontos de vendas antigas (`legacyRowToItems`/`legacyRowToDiscounts` em `lib/sales/repository.ts`).
- **Contexto**: nenhum `repository.ts` do projeto tem teste próprio hoje. Essa lógica específica é a mais arriscada de todas: decide como uma venda antiga (uma coluna `product_id`/`quantity`) é lida como se fosse uma venda nova (lista de itens) — um erro aqui faria vendas antigas mudarem de comportamento silenciosamente.
- **Critérios de conclusão**: teste cobre no mínimo: uma linha com `product_id`/`quantity`/`subtotal` legados (sem linhas em `sale_items`) gera exatamente um item com esses valores; uma linha com linhas em `sale_items` ignora as colunas legadas; uma linha com `discount` singular (legado) vira um array de um elemento; uma linha com `discounts` (array, novo) é usada como está. `npm test` passa.
- **Dependências**: nenhuma (funções puras, sem precisar de banco).
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

Nenhuma funcionalidade nova, além das já cobertas nas seções 1–3 acima, está documentada em `CLAUDE.md`, `progress.md` ou nos docs de fase (`00_MASTER_CONTEXT.md` a `06_PHASE_6...md`) como planejada e ainda não iniciada. Todos os núcleos listados em `CLAUDE.md` (Caixa, Resultado/DRE, Fluxo de caixa, Capital do proprietário, Despesas, Vendas, Produtos, Contatos, Cupons, Taxas da Nuvemshop, Tarefas, Canvas, Relatórios, Dashboard) já têm pelo menos uma implementação — os dois itens ainda pendentes de validação (Vendas multi-produto, Integração com IA) estão na seção 3, não aqui. Esta seção fica intencionalmente vazia para não inventar escopo.

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
