# DEV vs. PROD

Um único código, um único repositório, uma única aplicação na Vercel — DEV e
PROD são separados por **branch** e por **qual Supabase/env vars cada
deploy usa**, nunca por `if` espalhado pelo código.

## As duas branches

| Branch | O que é | Onde roda | Banco |
|---|---|---|---|
| `main` | Produção — estável, aprovada | Vercel Production (o app publicado, domínio real) | Supabase de **produção** (`rzxtkwdbgvunosrhsuhc`) — dados reais |
| `dev` | Desenvolvimento — onde toda funcionalidade nova nasce e é testada | Vercel Preview (URL própria, gerada a cada push) | Supabase de **dev** — dados de teste (ver status abaixo) |

Fluxo de toda funcionalidade nova, sem exceção:

```
dev → teste → aprovação (você) → merge em main → deploy em produção
```

Nunca commit direto em `main`. Nunca deploy de `dev` na Production da Vercel.

## Como saber em qual ambiente você está

- **No código/terminal**: `git branch --show-current`. Se eu (Claude) não
  tiver certeza de qual você quer dizer numa conversa, eu paro e pergunto —
  nunca assumo.
- **No app rodando**: um selo laranja **"DEV — dados de teste"** aparece no
  cabeçalho em qualquer ambiente que não seja produção (local, Preview).
  Produção nunca mostra esse selo — a ausência dele é o próprio sinal de
  que você está vendo o app real. Controlado por `NEXT_PUBLIC_APP_ENV`
  (só a Production da Vercel define isso como `"production"`).

## Dados de teste em DEV

**Status atual: pendente de decisão.** `.env.local` (uso local) ainda
aponta para o Supabase de produção — isso precisa mudar antes de retomar o
desenvolvimento normal, para nunca escrever/ler dado real sem querer. Duas
opções, sem criar uma segunda "coisa" desnecessária no código (só troca de
variável de ambiente, zero `if` novo):

1. **Supabase local** (`supabase start`, via CLI) — precisa de Docker, que
   não está instalado nesta máquina no momento.
2. **Um segundo projeto Supabase, gratuito, só para DEV** — mesma estrutura
   de tabelas (mesmas migrations), dados totalmente separados dos reais.

Depois que um dos dois existir, `npm run seed:dev -- <email>` popula esse
banco com os mesmos dados de exemplo que o app usava antes da migração para
Supabase — nunca rode isso apontando para produção.

## Deploy para produção

Não existe deploy automático de `dev` para a Production da Vercel. Promover
uma funcionalidade aprovada:

```
git checkout main
git merge dev
git push origin main   # dispara o deploy de produção
```

Migrations de banco (`supabase/migrations/*.sql`) seguem a mesma regra:
criadas e aplicadas primeiro no Supabase de DEV, só aplicadas em produção
depois de aprovadas — nunca automaticamente.

## Regra de segurança

Qualquer ação que possa alterar dados reais (aplicar uma migration em
produção, dar push em `main`, rodar um script apontando para o Supabase de
produção) é confirmada com você antes de acontecer — nunca assumida.
