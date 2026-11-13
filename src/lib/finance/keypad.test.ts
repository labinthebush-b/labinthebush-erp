import { describe, expect, it } from "vitest";
import { applyKeypadKey, KEYPAD_MAX_DIGITS, type KeypadKey } from "./keypad";

const type = (keys: KeypadKey[], start = 0) => keys.reduce(applyKeypadKey, start);

describe("applyKeypadKey", () => {
  it("digita em centavos, da direita para a esquerda", () => {
    expect(type(["1"])).toBe(1);
    expect(type(["1", "5"])).toBe(15);
    expect(type(["3", "8", "4", "0"])).toBe(3840); // R$ 38,40
  });

  it('"00" multiplica por 100; zero à esquerda não conta', () => {
    expect(type(["1", "5", "00"])).toBe(1500);
    expect(type(["0", "0", "00"])).toBe(0);
    expect(type(["0", "7"])).toBe(7);
  });

  it("apagar remove o último dígito e para no zero", () => {
    expect(type(["backspace"], 3840)).toBe(384);
    expect(type(["backspace", "backspace", "backspace", "backspace", "backspace"], 3840)).toBe(0);
  });

  it("ignora dígitos além do limite em vez de estourar", () => {
    const full = Number("9".repeat(KEYPAD_MAX_DIGITS));
    expect(applyKeypadKey(full, "1")).toBe(full);
    expect(applyKeypadKey(Number("9".repeat(KEYPAD_MAX_DIGITS - 1)), "00")).toBe(Number("9".repeat(KEYPAD_MAX_DIGITS - 1)));
  });
});
