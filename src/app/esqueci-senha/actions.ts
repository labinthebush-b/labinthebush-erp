"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ResetRequestState = { error?: string; sent?: boolean };

// Sempre a mesma resposta, exista ou não o e-mail: a tela não pode servir
// para descobrir quais e-mails têm conta. O link do e-mail volta para
// src/app/auth/confirm/route.ts no mesmo endereço em que o pedido foi feito
// (localhost no DEV, o domínio no PROD). Esse endereço precisa estar em
// Authentication → URL Configuration → Redirect URLs do projeto Supabase;
// se não estiver, o Supabase usa a Site URL.
export async function requestPasswordResetAction(
  _prevState: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Informe o e-mail." };

  try {
    const origin = (await headers()).get("origin");
    const supabase = await createClient();
    // O erro é ignorado de propósito (inclusive limite de envio): qualquer
    // mensagem diferente aqui revelaria algo sobre o e-mail digitado.
    await supabase.auth.resetPasswordForEmail(email, origin ? { redirectTo: `${origin}/auth/confirm` } : undefined);
  } catch {
    // Idem: falha de rede também cai na resposta padrão.
  }

  return { sent: true };
}
