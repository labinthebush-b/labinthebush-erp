# Lab in the Bush — Contexto da marca e do ERP

Estado atual, lido da pasta `ERPONBUSH` em 2026-09-29. Cada afirmação traz o arquivo de origem entre colchetes. O que a pasta não responde está em **Dúvidas** (seção 8).

Status: **rascunho, aguardando validação do Berpz.**

---

## 1. A marca

- Nome: **Lab in the Bush** [progress.md — nome do projeto Supabase de DEV "DEV-Lab in the bush"; todo.md — repositório `labinthebush-b/labinthebush-erp`].
- Tipo: pequena marca de moda [00_MASTER_CONTEXT.md].
- Dono: um único usuário no MVP, o proprietário [00_MASTER_CONTEXT.md].
- Canais de venda: e-commerce/Nuvemshop, Instagram e WhatsApp [00_MASTER_CONTEXT.md].
- Custos de produto são registrados em categorias "Produto POD", "Estampa", "Etiqueta", "Embalagem", "Frete", "Taxas" [02_PHASE_2_FINANCE.md; src/lib/catalog/seed.ts]. Isso indica produção sob demanda (POD), mas a pasta não descreve o fornecedor (ver Dúvidas).

## 2. A operação (do pedido ao pós-venda)

Só o que a pasta afirma:

1. O cliente compra por Nuvemshop, Instagram ou WhatsApp [00_MASTER_CONTEXT.md].
2. **A Nuvemshop é a plataforma operacional de pedidos.** O ERP não gere pedido, expedição nem logística; só registra a venda para análise financeira e gerencial [00_MASTER_CONTEXT.md; 03_PHASE_3].
3. No ERP, cada venda guarda: data, cliente/contato, produto(s), quantidade, cupom, valor total, canal, observações. Registrar uma venda gera a receita, liga ao contato e ao produto e permite calcular custo e lucro [03_PHASE_3_PRODUCTS_SALES_CONTACTS.md].
4. Vendas multi-produto, descontos acumulativos e taxa da Nuvemshop existem em código na branch `dev`, ainda não validados em banco real e não publicados em produção [progress.md, seção "In progress"; todo.md T3.1].
5. Pós-venda: o único mecanismo documentado é o histórico do contato (vendas, total comprado, nº de compras, última compra) e o pipeline de contatos (Lead, Cliente, Recorrente, Inativo) [03_PHASE_3; progress.md].
6. Produção, envio e trocas/devoluções: **não documentados** (ver Dúvidas).

## 3. O que já existe (sistemas e entregáveis)

### ERP (aplicação)
- Stack: Next.js, React, TypeScript, Tailwind, shadcn/ui, Supabase (banco, auth, storage), Vercel [CLAUDE.md; 01_PHASE_1; package.json].
- Produção: https://labinthebush-erp-5kgm.vercel.app, deploy já aprovado e feito [progress.md, "Completed"].
- Módulos em produção (`main`): Dashboard, Financeiro (transações, categorias, parcelamento, recorrência, fechamento mensal, histórico de edição), Produtos (catálogo, custo, simulação de margem), Vendas (um produto por venda, cupom único, frete), Contatos (CRM + pipeline), Tarefas (kanban/lista), Canvas, Configurações, Relatórios, Planejamento (aportes/reservas, orçamento por categoria), Backup (export JSON), Autenticação com RLS [progress.md].
- Em desenvolvimento (só `dev`): Vendas multi-produto + taxa Nuvemshop; integração com IA via MCP (`/api/mcp`, chaves de API, propor/confirmar lançamento) [progress.md; todo.md].
- Banco: 16 tabelas em 3 migrations (0001 base, 0002 IA, 0003 `sale_items`) [supabase/migrations].
- Testes: 286 de 286 passando, lint e build ok [progress.md, décima atualização].

### Ambientes
| Ambiente | Branch | Banco | Situação |
|---|---|---|---|
| Produção | `main` | Supabase `rzxtkwdbgvunosrhsuhc`, dados reais | migrations 0001 e 0002 aplicadas; 0003 não |
| DEV | `dev` | Supabase "DEV-Lab in the bush" (`wyhrsizevngjqbbynkou`), vazio de dados | 0001–0003 aplicadas manualmente pelo usuário |

[ENVIRONMENTS.md; progress.md]. Regra: DEV, teste, aprovação, PROD. Nunca migration ou dado real em PROD sem confirmação [CLAUDE.md].

### Dashboard e outros artefatos
- Não há outros sistemas documentados dentro da pasta `ERPONBUSH`. Existem pastas irmãs (Ecommerce, Campanha, Redes, Peças) fora do escopo desta leitura. Ver Dúvidas.

### Catálogo real
- **A pasta não contém o catálogo real** (produtos, coleções, SKUs, estampas). Os únicos produtos são de exemplo, para o ambiente DEV: "Camiseta Oversized Preta", "Moletom Canguru Cinza" e "Boné Aba Curva Logo" (rascunho), com preços e custos fictícios [src/lib/catalog/seed.ts; scripts/seed-dev-data.ts]. Não tratar como catálogo da marca.

## 4. O como (processos e regras)

### Financeiro (eixo central do ERP) [02_PHASE_2_FINANCE.md]
- Tipos de transação: receita, despesa, aporte, retirada.
- **Aporte** aumenta caixa e capital aportado; não é receita e não muda lucro. **Retirada** reduz caixa; não é despesa e não muda lucro.
- Resultado: receita − custo dos produtos = lucro bruto; − despesas operacionais = lucro líquido.
- Caixa, resultado, patrimônio e capital do proprietário são conceitos separados.
- Contas futuras (a pagar/receber, parcelas, recorrências) só afetam o caixa realizado quando efetivadas.
- Transação editada é marcada "*editado". Há fechamento mensal, com reabertura explícita.
- Categorias iniciais: Receitas (Venda, Outros recebimentos); Custos (Produto POD, Estampa, Etiqueta, Embalagem, Frete, Taxas, Outros); Despesas (Software, Plataforma, Marketing, Contabilidade, Serviços, Equipamentos, Outros); Capital (Aporte, Retirada).
- Taxa da Nuvemshop: configurável em Configurações, gravada em pontos-base (499 = 4,99%). O valor real não está na pasta [src/lib/settings].

### Produtos [03_PHASE_3]
- Cadastro simples, campos opcionais. Custo em componentes editáveis (POD, etiqueta, embalagem, frete, taxa, outros). O ERP calcula custo total, lucro, margem e % de cada componente.
- Simulador (brinde, desconto, embalagem, custo extra) **não altera** o produto real; só "Aplicar à realidade" altera, com ação explícita.
- Alerta de margem abaixo de um limite configurável [05_PHASE_5; settings.margin_threshold_percent].

### Contatos, tarefas, canvas
- Contato único com status Lead, Cliente, Recorrente, Inativo e campos personalizados [03_PHASE_3].
- Tarefas em kanban, lista e agenda sobre a mesma fonte; "Planejar amanhã"; sem tarefas recorrentes no MVP [04_PHASE_4].
- Canvas único e infinito, estilo Milanote, com imagens por arrastar/colar e links [04_PHASE_4].

### Processo de desenvolvimento do ERP [loop.md; CLAUDE.md]
Loop de uma tarefa por vez a partir de `todo.md`: Developer, verificação (test, lint, build, diff), Tester independente, correção se falhar, conclusão com `todo.md` e `progress.md` atualizados. Roda só em DEV; nunca toca `main` nem produção.

### Fora do escopo do ERP (por decisão) [00_MASTER_CONTEXT.md]
RH, folha, contabilidade completa, logística, MRP, produção industrial, CRM avançado, permissões complexas, integração bancária, app mobile, gestão de pedidos da Nuvemshop, emissão fiscal.

## 5. O fornecedor

**A pasta não documenta fornecedor.** Não há nome, contato, prazos, custos reais, limites técnicos ou condições em nenhum arquivo lido. Só há: a categoria de custo "Produto POD", o campo "fornecedor/POD" no cadastro de produto [03_PHASE_3] e um custo de exemplo fictício (R$ 45,00 POD numa camiseta) [seed.ts]. Tudo o mais em Dúvidas.

## 6. As etapas (onde está cada frente)

Fase atual: **pós-Fase 6, expansão em `dev`** [progress.md, "Current phase"].

| Frente | Estado | Próximo passo |
|---|---|---|
| ERP núcleo (8 módulos + relatórios, planejamento, backup, auth) | Em produção | Manutenção |
| Ambiente DEV | Supabase DEV criado, migrations aplicadas, schema validado contra o código | T1.2: popular com dados de exemplo (`npm run seed:dev -- <email>`) |
| `dev` no GitHub | **Bloqueado**: `git push` retorna 403 (credencial de outra conta em cache). Commits só existem nesta máquina | T1.1: token com permissão de escrita, ou o Berpz roda o push |
| Vercel Preview | Env vars nunca verificadas | T1.3: conferir que Preview aponta para o DEV, não para produção |
| Vendas multi-produto | Código e testes de lógica prontos, sem teste em banco real | T3.1 |
| Integração com IA (MCP) | Testes unitários prontos (T2.1, T2.2), nunca testada com chave real | T3.2 |
| RLS no DEV | Não confirmado ao vivo | T2.3 |
| Teste da lógica legada de vendas | Pendente | T2.4 (sem dependência externa; próxima recomendada) |

Ordem recomendada pelo backlog: destravar ambiente, depois validar em banco real, depois aprovação explícita para merge `dev` → `main` [progress.md, "Next action"; todo.md].

## 7. Visão e missão

**Não estão na pasta.** O único enunciado de propósito é do ERP, não da marca: "sistema operacional interno da marca", que responde rápido a quanto dinheiro tem, quanto vendeu, quanto lucrou, o que fazer e o que estou criando [00_MASTER_CONTEXT.md]. Visão e missão da marca ficam em Dúvidas.

---

## 8. Dúvidas (para o Berpz)

**Marca e visão**
1. Qual a visão e a missão da Lab in the Bush? Onde a marca quer estar em 6 e 12 meses?
2. Qual o posicionamento e o público? (Não há nenhum arquivo de estratégia na pasta.)

**Catálogo**
3. Quais são os produtos, coleções, SKUs e estampas reais hoje à venda ou em lançamento? A pasta só tem produtos de exemplo.
4. A loja Nuvemshop já está no ar? Qual o endereço e o plano contratado?

**Fornecedor**
5. Quem é o fornecedor POD? Preciso de: nome, contato, prazo de produção e de envio, custo por peça, mínimo de pedido, limites técnicos de estampa, política de defeito/troca e forma de pagamento.
6. Existe mais de um fornecedor (por exemplo um para etiquetas e embalagens)?

**Operação**
7. Como um pedido flui na prática: quem confere o pedido na Nuvemshop, como ele chega ao fornecedor, quem acompanha a entrega e como o rastreio chega ao cliente?
8. Como são tratados trocas, devoluções e atendimento pós-venda?
9. Qual a taxa real da Nuvemshop e das formas de pagamento? A pasta só sabe que existe um campo configurável.
10. Vendas por Instagram e WhatsApp: como o pedido é fechado, cobrado e enviado?

**Financeiro**
11. Quais as despesas recorrentes reais (Nuvemshop, MEI, ferramentas de IA etc.)? Os dados reais estão só no banco de produção, que esta pasta não expõe.
12. Existe meta de margem ou de faturamento? (Só existe um limite de alerta de margem configurável, sem valor definido na pasta.)

**Ambiente e escopo da pasta**
13. Quem é o "Berpz" em relação ao dono do repositório? O `progress.md` cita uma credencial GitHub "Dinossaurkillerjr", e o repositório é `labinthebush-b`. Qual conta deve fazer o push de `dev`?
14. As pastas irmãs em `Lab In The Bush` (Ecommerce, Campanha, Redes, Peças, LAB, REMIX POD) contêm material da marca (artes, estampas, fotos). Devo tratá-las como parte da fonte da verdade? Por ora fiz leitura só de `ERPONBUSH` e das listas de nomes dessas pastas.
15. O `DESIGN.md` (estilo "Dub") é o Design System oficial da marca ou só uma referência?

---

## Contradições encontradas entre arquivos

| # | O que diz | Onde | Como tratei |
|---|---|---|---|
| 1 | `.env.local` ainda aponta para produção, e o DEV está "pendente de decisão" | ENVIRONMENTS.md | `progress.md` (mais recente) diz que o DEV foi criado e `.env.local` já aponta para ele. Considerei `progress.md`. ENVIRONMENTS.md está desatualizado. |
| 2 | Deploy em produção só após aprovação, como última etapa | 00_MASTER_CONTEXT.md, 06_PHASE_6 | `progress.md` registra que o deploy já foi aprovado e feito. Os docs 00 a 06 são planejamento antigo, e o próprio `todo.md` os classifica como históricos. |
| 3 | `dev` tem 8 commits sem push | todo.md T1.1 | `progress.md` cita 4 e depois 5 commits em pontos diferentes. Provavelmente crescimento ao longo do dia, mas não verifiquei o git. |
| 4 | Migration 0003 "não aplicada em lugar nenhum" | progress.md (atualização inicial) | A quinta atualização diz que 0001–0003 foram aplicadas no DEV. Vale a mais recente. |
| 5 | Stack "[demais tecnologias existentes no projeto]" (placeholder não preenchido) | CLAUDE.md | Completei a stack a partir de `package.json` e `01_PHASE_1`. |
| 6 | `DESIGN.md` descreve o sistema visual da "Dub" (referência de outro produto), não da Lab in the Bush | DESIGN.md | `00_MASTER_CONTEXT.md` diz que o Design System do proprietário é a autoridade visual. Não está claro se o Dub é esse sistema ou só referência (pergunta 15). |

## O que não li

- `.env.local` e os backups de env: contêm segredos, e o contexto não precisa deles.
- Código-fonte em `src/` além de `seed.ts` e `settings`; a lógica está descrita pelos docs e por `progress.md`. Se quiser, faço uma leitura módulo a módulo.
- `DESIGN.md` inteiro (li só o início); `.claude/skills` e `.agents` (skills de terceiros do Supabase).
