# TODO

Gerado a partir de uma auditoria completa do projeto em 2026-09-24 (branch `dev`, commit `4c07f45`). Ordem = ordem recomendada de execução; nada aqui foi implementado ainda.

## 1. Ambiente (bloqueia tudo abaixo — fazer primeiro)

- [ ] Enviar a branch `dev` para o GitHub (`git push -u origin dev`) — hoje existe só localmente, 4 commits sem backup remoto.
- [ ] Sincronizar `main` com `origin/main` (`git push origin main`) — o commit da correção de env var já está em produção mas nunca foi enviado ao Git.
- [ ] Criar um projeto Supabase gratuito dedicado a DEV (decisão já tomada na sessão anterior, só falta executar).
- [ ] Aplicar as migrations `0001_init.sql`, `0002_ai_integration.sql` e `0003_sales_multi_item.sql` nesse projeto de DEV (nunca em produção).
- [ ] Atualizar `.env.local` para apontar para o Supabase de DEV (hoje ainda aponta para produção).
- [ ] Rodar `npm run seed:dev -- <email>` para popular o banco de DEV com dados de exemplo.
- [ ] Conferir no dashboard da Vercel se as environment variables do ambiente **Preview** já estão separadas das de **Production** (evitar que um deploy de teste da branch `dev` acesse dados reais).

## 2. Validar o que só tem teste de lógica (nunca rodou contra um banco real)

- [ ] Testar manualmente Vendas multi-produto contra o Supabase de DEV: criar venda com 2+ produtos, editar quantidade/preço, aplicar 2 descontos acumulados, canal Nuvemshop com taxa configurada, excluir a venda — conferir que `sale_items` e os lançamentos vinculados no Financeiro (receita, frete, taxa) se comportam corretamente.
- [ ] Testar manualmente a integração de IA contra o Supabase de DEV: gerar uma chave em Configurações, chamar `/api/mcp` com ela, rodar uma consulta (`get_caixa`), propor um lançamento (`propose_transaction`) e confirmar (`confirm_transaction`) — conferir que a transação aparece no Financeiro.

## 3. Cobertura de testes faltando

- [ ] Testes para `lib/ai/keys.ts` (gerar chave, hash, verificar, revogar) — hoje sem nenhuma cobertura, é o código que autentica terceiros.
- [ ] Testes para `lib/ai/proposals.ts` e `lib/ai/tools/transactions.ts` (propose/confirm/cancel) — hoje sem nenhuma cobertura, é o código que escreve lançamentos financeiros a partir de uma fonte externa.
- [ ] Pelo menos um teste de repository para a lógica de compatibilidade legada em `lib/sales/repository.ts` (`legacyRowToItems`/`legacyRowToDiscounts`) — nenhum repository do projeto tem teste hoje.

## 4. Promoção para produção (só depois de 1–3 aprovados)

- [ ] Sua revisão e aprovação explícita das duas funcionalidades (Vendas multi-produto, Integração com IA).
- [ ] `git checkout main && git merge dev && git push origin main`.
- [ ] Aplicar as migrations pendentes (0002 já está em produção; falta 0003) no Supabase de **produção**, com sua confirmação explícita antes.
- [ ] Conferir o app publicado depois do deploy.

## 5. Manutenção / hygiene (baixa prioridade, pode intercalar a qualquer momento)

- [ ] Reescrever `README.md` — hoje é o boilerplate padrão do `create-next-app`, não descreve o ERP.
- [ ] Marcar os docs `00_PHASE_*` a `06_PHASE_*` como histórico/arquivado (são do planejamento pré-deploy; `progress.md`/`todo.md` são a fonte de verdade agora).
- [ ] Silenciar o aviso do `vitest.config.ts` sobre ESM/CommonJS (cosmético, não afeta os testes).

## Não é bug, só uma observação registrada

- Todo o schema usa FK que verificam apenas existência da linha referenciada, não posse por usuário (ex.: `sales.product_id`, `sale_items.product_id` → `products.id`). Isso é assim desde a Fase 3, não é algo introduzido agora, e não é explorável pela UI atual (o navegador só envia os IDs de produtos do próprio usuário) — mas vale ter em mente se um dia a IA ou uma API externa passarem a aceitar IDs arbitrários do cliente.
- `upsertSales` apaga e reinsere os itens de uma venda em duas chamadas separadas (não é uma transação de banco única) — uma falha de rede exatamente entre as duas chamadas deixaria a venda com zero itens até a próxima sincronização. Risco baixo (uso single-user, poucas edições) mas real; documentar antes de escalar para múltiplos usuários simultâneos.
