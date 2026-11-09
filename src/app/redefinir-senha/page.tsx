"use client";

import { useActionState } from "react";
import { updatePasswordAction, type NewPasswordState } from "./actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/common/field";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const initialState: NewPasswordState = {};

export default function RedefinirSenhaPage() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper-mist p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Nova senha</CardTitle>
          <CardDescription>Escolha a nova senha da sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <Field label="Nova senha" htmlFor="password" hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres.`}>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoFocus
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirmar nova senha" htmlFor="confirmation">
              <Input
                id="confirmation"
                name="confirmation"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
            </Field>
            {state.error ? <p className="text-caption text-destructive">{state.error}</p> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
