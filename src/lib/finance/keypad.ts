// Teclado de calculador do lançamento rápido: o valor é digitado da direita
// para a esquerda, em centavos (1 → 0,01; 15 → 0,15; 1500 → 15,00).

export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "00" | "backspace";

/** Até R$ 9.999.999,99 — mais que isso é engano de digitação. */
export const KEYPAD_MAX_DIGITS = 9;

export function applyKeypadKey(cents: number, key: KeypadKey): number {
  if (key === "backspace") return Math.floor(cents / 10);
  const next = `${cents === 0 ? "" : cents}${key}`.replace(/^0+/, "");
  if (next.length > KEYPAD_MAX_DIGITS) return cents;
  return next ? Number(next) : 0;
}
