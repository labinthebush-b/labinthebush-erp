"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateNewPassword } from "@/lib/auth/password";

export type NewPasswordState = { error?: string };

// Troca a senha do usuário da sessão atual — a criada por /auth/confirm a
// partir do link do e-mail (o proxy barra esta tela sem sessão). Nem a senha
// nem o erro bruto do Supabase vão para log.
export async function updatePasswordAction(
  _prevState: NewPasswordState,
  formData: FormData
): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  const invalid = validateNewPassword(password, confirmation);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/esqueci-senha?erro=link-invalido");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "A nova senha precisa ser diferente da atual." };
    if (error.code === "weak_password") return { error: "Senha fraca. Use uma senha mais longa ou variada." };
    return { error: "Não foi possível alterar a senha. Peça um novo link e tente de novo." };
  }

  redirect("/");
}
