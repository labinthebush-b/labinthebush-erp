"use client";

import * as React from "react";
import { toast } from "sonner";
import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DateInput } from "@/components/common/date-input";
import { Segmented } from "@/components/common/segmented";
import { useFinance } from "@/lib/finance/finance-provider";
import { GROUPS_BY_TYPE } from "@/lib/finance/categories";
import { todayISO } from "@/lib/finance/actions";
import { applyKeypadKey, KEYPAD_MAX_DIGITS, type KeypadKey } from "@/lib/finance/keypad";
import { formatCurrencyCents, parseCurrencyDigitsToCents } from "@/lib/currency";
import { cn } from "@/lib/utils";

type Kind = "expense" | "income";
type When = "hoje" | "ontem" | "outra";

const KEYS: { key: KeypadKey; label: React.ReactNode; aria: string }[] = [
  ...(["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const).map((k) => ({ key: k, label: k, aria: k })),
  { key: "00", label: "00", aria: "zero zero" },
  { key: "0", label: "0", aria: "0" },
  { key: "backspace", label: <Delete className="size-5" />, aria: "Apagar último dígito" },
];

function isoDaysAgo(days: number): string {
  const [y, m, d] = todayISO().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

function toISODate(date?: Date): string | undefined {
  if (!date) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Lançamento rápido no jeito de calculadora (redesign 2026-11): o valor
 * primeiro e grande, categoria em botões, data em "Hoje / Ontem". Para
 * parcelado, recorrente, aporte/retirada ou observações, "Mais opções" abre o
 * formulário completo de sempre.
 */
export function QuickTransactionForm({ onDone, onMoreOptions }: { onDone: () => void; onMoreOptions: () => void }) {
  const { categories, addTransaction, isMonthClosed } = useFinance();
  const [kind, setKind] = React.useState<Kind>("expense");
  const [cents, setCents] = React.useState(0);
  const [category, setCategory] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [when, setWhen] = React.useState<When>("hoje");
  const [otherDate, setOtherDate] = React.useState<Date | undefined>();
  const [settled, setSettled] = React.useState(true);

  const options = React.useMemo(() => {
    const groups = GROUPS_BY_TYPE[kind] as readonly string[];
    return categories.filter((c) => groups.includes(c.group));
  }, [categories, kind]);

  const date = when === "hoje" ? todayISO() : when === "ontem" ? isoDaysAgo(1) : toISODate(otherDate);
  const categoryLabel = options.find((c) => c.id === category)?.label;

  function changeKind(next: Kind) {
    setKind(next);
    setCategory("");
  }

  function save() {
    if (cents <= 0) return toast.error("Digite o valor.");
    if (!category) return toast.error("Escolha a categoria.");
    if (!date) return toast.error("Escolha a data.");
    if (isMonthClosed(date)) return toast.error("Este mês está fechado. Reabra-o em Fechar mês para lançar nele.");
    addTransaction({
      type: kind,
      amount: cents,
      date,
      category,
      // Descrição é opcional aqui: sem ela, vale o nome da categoria.
      description: description.trim() || categoryLabel || "Lançamento",
      paymentSource: "conta_marca",
      status: settled ? "concluido" : "pendente",
      dueDate: settled ? undefined : date,
    });
    toast.success(`${kind === "expense" ? "Saída" : "Entrada"} de ${formatCurrencyCents(cents)} lançada.`);
    onDone();
  }

  return (
    <div className="flex flex-col gap-5">
      <Segmented
        label="Tipo de lançamento"
        value={kind}
        onChange={changeKind}
        options={[
          { value: "expense", label: "Saída" },
          { value: "income", label: "Entrada" },
        ]}
        className="self-start"
      />

      <div className="brand-gradient brand-gradient-animated rounded-3xl px-5 py-4">
        <label className="flex flex-col gap-1">
          <span className="text-caption">
            {kind === "expense" ? "Saída" : "Entrada"}
            {categoryLabel ? ` · ${categoryLabel}` : ""}
          </span>
          <input
            inputMode="numeric"
            aria-label="Valor"
            value={formatCurrencyCents(cents)}
            onChange={(e) => {
              const next = parseCurrencyDigitsToCents(e.target.value);
              if (String(next).length <= KEYPAD_MAX_DIGITS) setCents(next);
            }}
            className="w-full bg-transparent font-display text-[44px] leading-tight tracking-tight outline-none"
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYS.map(({ key, label, aria }) => (
          <button
            key={key}
            type="button"
            aria-label={aria}
            onClick={() => setCents((c) => applyKeypadKey(c, key))}
            className="flex h-12 items-center justify-center rounded-2xl border border-border bg-card font-display text-body-xl transition-colors hover:bg-paper-mist focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-caption text-muted-foreground">Categoria</span>
        <div role="radiogroup" aria-label="Categoria" className="flex flex-wrap gap-1.5">
          {options.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "h-9 rounded-full border px-3.5 text-body transition-colors",
                category === c.id ? "border-primary bg-primary text-primary-foreground" : "border-smoke bg-card hover:bg-paper-mist"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-caption text-muted-foreground">Quando</span>
        <Segmented
          label="Data do lançamento"
          variant="chips"
          value={when}
          onChange={setWhen}
          options={[
            { value: "hoje", label: "Hoje" },
            { value: "ontem", label: "Ontem" },
            { value: "outra", label: "Outra data" },
          ]}
        />
        {when === "outra" ? <DateInput value={otherDate} onValueChange={setOtherDate} /> : null}
      </div>

      <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" aria-label="Descrição" />

      <label className="flex items-center justify-between gap-3 rounded-2xl bg-paper-mist px-4 py-3 text-body">
        {kind === "expense" ? "Já foi pago" : "Já foi recebido"}
        <Switch checked={settled} onCheckedChange={setSettled} />
      </label>

      <div className="flex flex-col gap-2">
        <Button size="lg" onClick={save}>
          Salvar {cents > 0 ? formatCurrencyCents(cents) : "lançamento"}
        </Button>
        <Button variant="ghost" onClick={onMoreOptions}>
          Mais opções: parcelado, recorrente, aporte, retirada
        </Button>
      </div>
    </div>
  );
}
