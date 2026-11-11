# Plano — Recuperação de senha (DEV e PROD)

Status: **plano, nada implementado.** Segue o fluxo do `CLAUDE.md`: DEV → testes → revisão → aprovação → PROD.

## Problema

O link do e-mail de recuperação do Supabase leva a uma página com erro. Causas:

1. O app não tem rota que receba o link: só existe `/login` (`src/app/login`).
2. `src/proxy.ts` redireciona para `/login` qualquer rota sem sessão, exceto `/login` e `/api/*`. Uma rota nova de recuperação seria barrada.
3. A **Site URL** de cada projeto Supabase pode apontar para um endereço fora do ar ou do ambiente errado.

## Abordagem

Usar `token_hash` + `verifyOtp` (fluxo recomendado do Supabase para SSR). Ao contrário do PKCE (`?code=`), funciona mesmo se o e-mail for aberto em outro navegador ou aparelho, porque não depende de cookie criado antes. Sem dependência nova: `@supabase/ssr` já está no projeto.

Fluxo:

```
/login → "Esqueci a senha" → /esqueci-senha (digita e-mail)
  → supabase.auth.resetPasswordForEmail(email)
  → e-mail com link {SiteURL}/auth/confirm?token_hash=...&type=recovery
  → /auth/confirm (route handler): verifyOtp → cria sessão → redirect /redefinir-senha
  → /redefinir-senha (nova senha + confirmação) → supabase.auth.updateUser({ password })
  → redirect /
```

## Arquivos (código)

| Arquivo | O que faz |
|---|---|
| `src/app/login/page.tsx` | Link "Esqueci a senha" abaixo do botão Entrar |
| `src/app/esqueci-senha/page.tsx` + `actions.ts` | Formulário de e-mail. Sempre responde "se o e-mail existir, enviamos o link" (não revela quais e-mails existem) |
| `src/app/auth/confirm/route.ts` | GET: lê `token_hash` e `type`, chama `verifyOtp`, redireciona para `/redefinir-senha`; em falha, vai para `/login` com mensagem |
| `src/app/redefinir-senha/page.tsx` + `actions.ts` | Nova senha (mín. 8 caracteres) + confirmação, `updateUser`, redirect `/` |
| `src/proxy.ts` | Liberar sem sessão: `/esqueci-senha` e `/auth/confirm`. `/redefinir-senha` exige a sessão criada pelo link |
| Testes (Vitest) | Validação de senha; proxy libera as rotas certas e continua barrando as demais; a action não vaza se o e-mail existe |

Não há migration: tudo usa o Supabase Auth existente.

## Configuração no Supabase (manual, por ambiente)

Fazer **primeiro no DEV**, testar, e só depois no PROD, com aprovação explícita.

Em cada projeto, no painel do Supabase:

1. **Authentication → URL Configuration**
   - **Site URL**: o endereço real do ambiente.
     - DEV: `http://localhost:3000` (ou a porta usada) e/ou a URL de Preview da Vercel.
     - PROD: o domínio de produção.
   - **Redirect URLs**: incluir `<endereço>/**`.
2. **Authentication → Email Templates → Reset Password**: trocar o link por
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
   ```
3. Conferir que o e-mail do usuário existe em **Authentication → Users** de cada ambiente. DEV e PROD têm usuários separados.

Observação: o envio de e-mail padrão do Supabase tem limite baixo por hora. Para uso individual basta. Se o limite incomodar, configurar SMTP próprio (decisão futura, fora deste plano).

## Etapas

1. **Implementar em DEV** (branch `dev`): as 4 telas/rotas, o ajuste no proxy e os testes.
2. **Configurar o Supabase DEV** (URL Configuration + template).
3. **Testar em DEV**: pedir recuperação, abrir o link, definir a senha, entrar. Casos: link expirado, link usado duas vezes, e-mail inexistente, abrir o link em outro navegador.
4. **Rodar** `npm test`, `npm run lint` e `npm run build`.
5. **Revisão** (agente tester) e **sua aprovação**.
6. **PROD**: merge `dev` → `main` (pede sua confirmação para o push), depois configurar o Supabase PROD (URL Configuration + template) e testar com o seu usuário real. Nada de dados de PROD é alterado além da troca da senha que você mesmo pedir.

## Riscos e cuidados

- Nunca apontar `.env.local` para PROD durante os testes.
- A Site URL errada é a falha mais comum. Cada ambiente precisa da sua.
- Template de e-mail alterado no PROD afeta os e-mails reais. Alterar só depois do DEV validado.
- Não registrar senhas nem tokens em log.

## Fora do escopo

Cadastro público, login social, 2FA, SMTP próprio.
