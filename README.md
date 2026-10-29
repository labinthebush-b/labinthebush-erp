# ERP Lab in the Bush

ERP interno da marca: financeiro (caixa, resultado/DRE, fluxo de caixa, capital do proprietário, planejamento), vendas, produtos, estoque por tamanho e cor, contatos, tarefas, canvas, marketing (GA4 + Instagram), relatórios e dashboard. Uso individual, desktop-first, em português.

Stack: Next.js 16 (App Router, `src/proxy.ts`), React 19, TypeScript, Tailwind 4 + shadcn/ui, Supabase (Auth, Postgres com RLS, Storage), Vitest, Vercel.

## Rodar localmente

Requisitos: Node.js 20.9+ e acesso ao projeto Supabase de **DEV**.

```bash
cp .env.local.example .env.local   # preencher com as chaves do Supabase DEV — nunca de produção
npm ci
npm run dev -- -p 3470
```

Login com a conta de teste do Supabase DEV. O selo laranja "DEV — dados de teste" no cabeçalho confirma que não é produção.

O Supabase DEV está no plano gratuito e pausa após alguns dias sem uso: se o app não conectar, reative o projeto no dashboard do Supabase.

## Comandos

| Comando | O que faz |
|---|---|
| `npm test` | testes unitários (Vitest) |
| `npm run lint` | ESLint |
| `npm run build` | build de produção |
| `npm run seed:dev -- <email>` | popula o Supabase DEV com dados de exemplo (nunca apontar para produção) |

## Documentação do projeto

- `CLAUDE.md` — regras do projeto (DEV → testes → revisão → aprovação → PROD).
- `ENVIRONMENTS.md` — DEV × PROD, branches e deploy.
- `todo.md` — backlog oficial; `progress.md` — histórico e estado atual.
- `loop.md` + `.claude/agents/` — protocolo developer/tester.
- `supabase/migrations/` — aplicadas manualmente no SQL Editor, primeiro no DEV, depois em PROD com aprovação.
- `DESIGN.md` — design system; `CONTEXTO_MARCA.md` — contexto da marca.
- `PLANO_MENSURACAO_MARKETING.md`, `PLANO_MARKETING_ATRIBUICAO.md` — módulo de Marketing.
- `00_MASTER_CONTEXT.md` a `06_PHASE_6_*.md` — planejamento original (histórico).
