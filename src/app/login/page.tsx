"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, type SignInState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/common/field";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const initialState: SignInState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper-mist p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>ERP da Marca</CardTitle>
          <CardDescription>Entre com sua conta para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <Field label="E-mail" htmlFor="email">
              <Input id="email" name="email" type="email" required autoFocus autoComplete="email" />
            </Field>
            <Field label="Senha" htmlFor="password">
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </Field>
            {state.error ? <p className="text-caption text-destructive">{state.error}</p> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Entrando..." : "Entrar"}
            </Button>
            <Link
              href="/esqueci-senha"
              className="text-center text-caption text-muted-foreground underline underline-offset-4"
            >
              Esqueci a senha
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
