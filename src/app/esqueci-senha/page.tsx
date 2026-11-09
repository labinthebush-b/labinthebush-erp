"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { requestPasswordResetAction, type ResetRequestState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/common/field";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const initialState: ResetRequestState = {};

// ?erro=link-invalido vem de /auth/confirm (link expirado, já usado ou
// incompleto) e de /redefinir-senha sem sessão. O aviso fica aqui, e não no
// /login, porque o proxy manda quem já está logado de /login para o início e
// a mensagem se perderia.
export default function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);
  const linkInvalido = use(searchParams).erro === "link-invalido";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper-mist p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>Informe o e-mail da sua conta para receber o link de redefinição.</CardDescription>
        </CardHeader>
        <CardContent>
          {state.sent ? (
            <div className="flex flex-col gap-4">
              <p className="text-body text-foreground">
                Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha. Confira a caixa de entrada e o
                spam.
              </p>
              <Link href="/login" className="text-caption text-muted-foreground underline underline-offset-4">
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-4">
              {linkInvalido ? (
                <p className="text-caption text-destructive">
                  O link de recuperação expirou ou já foi usado. Peça um novo abaixo.
                </p>
              ) : null}
              <Field label="E-mail" htmlFor="email">
                <Input id="email" name="email" type="email" required autoFocus autoComplete="email" />
              </Field>
              {state.error ? <p className="text-caption text-destructive">{state.error}</p> : null}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Enviando..." : "Enviar link"}
              </Button>
              <Link href="/login" className="text-center text-caption text-muted-foreground underline underline-offset-4">
                Voltar para o login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
