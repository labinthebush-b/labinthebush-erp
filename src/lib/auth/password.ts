// Regras da nova senha na tela /redefinir-senha. O Supabase Auth também tem
// um mínimo próprio (configurável no painel); este aqui é o do app, checado
// antes de chamar o Supabase para dar uma mensagem clara em português.
export const MIN_PASSWORD_LENGTH = 8;

/** Devolve a mensagem de erro, ou null quando a senha pode ser usada. */
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (!password) return "Informe a nova senha.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password !== confirmation) return "As senhas não conferem.";
  return null;
}
