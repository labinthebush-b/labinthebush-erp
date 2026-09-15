// Pure builders for Financeiro entities — the single place that knows how a
// request to "add a transaction/parcelamento/regra recorrente" turns into
// the actual domain objects (id, timestamps, parcelas, grupo). No side
// effects, no Supabase, no React.
//
// Used by FinanceProvider (which dispatches the result into the reducer,
// for the local UI) AND by the AI integration layer (src/lib/ai), which
// persists the result directly via the repository after the user confirms a
// proposal. Keeping this here means both call the exact same rule for "what
// is a valid transaction" instead of the AI layer growing its own copy.
import type {
  Category,
  InstallmentGroup,
  PaymentSource,
  RecurringRule,
  Transaction,
  TransactionRelations,
  TransactionStatus,
  TransactionType,
} from "./types";
import { addMonthsToISODate, splitAmountIntoInstallments } from "./calculations";

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayISO(): string {
  return nowISO().slice(0, 10);
}

export type NewTransactionInput = {
  type: TransactionType;
  amount: number;
  date: string;
  category: string;
  description: string;
  paymentSource: PaymentSource;
  status: TransactionStatus;
  dueDate?: string;
  notes?: string;
  relations?: TransactionRelations;
};

export function buildTransaction(input: NewTransactionInput): Transaction {
  const timestamp = nowISO();
  return {
    id: makeId(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
    edited: false,
  };
}

export type NewInstallmentInput = Omit<NewTransactionInput, "amount" | "status"> & {
  totalAmount: number;
  installmentsCount: number;
  /** Whether the first installment is already settled. */
  firstInstallmentSettled: boolean;
};

export function buildInstallmentTransactions(input: NewInstallmentInput): {
  group: InstallmentGroup;
  transactions: Transaction[];
} {
  const timestamp = nowISO();
  const groupId = makeId();
  const amounts = splitAmountIntoInstallments(input.totalAmount, input.installmentsCount);

  const transactions: Transaction[] = amounts.map((amount, index) => {
    const date = addMonthsToISODate(input.date, index);
    const settled = index === 0 && input.firstInstallmentSettled;
    return {
      id: makeId(),
      type: input.type,
      amount,
      date,
      dueDate: settled ? undefined : date,
      category: input.category,
      description: input.description,
      paymentSource: input.paymentSource,
      status: settled ? "concluido" : "pendente",
      createdAt: timestamp,
      updatedAt: timestamp,
      edited: false,
      notes: input.notes,
      relations: { installmentGroupId: groupId },
      installment: { number: index + 1, total: input.installmentsCount },
    };
  });

  const group: InstallmentGroup = {
    id: groupId,
    description: input.description,
    totalAmount: input.totalAmount,
    installmentsCount: input.installmentsCount,
    createdAt: timestamp,
  };

  return { group, transactions };
}

export type NewRecurringRuleInput = {
  description: string;
  amount: number;
  category: string;
  paymentSource: PaymentSource;
  type: Extract<TransactionType, "expense" | "income">;
  dayOfMonth: number;
  startDate: string;
  endDate?: string;
};

export function buildRecurringRule(input: NewRecurringRuleInput): RecurringRule {
  return {
    id: makeId(),
    frequency: "mensal",
    active: true,
    createdAt: nowISO(),
    ...input,
  };
}

export function buildCustomCategory(label: string, group: Category["group"]): Category {
  return {
    id: `${group}-${label.toLowerCase().replace(/\s+/g, "-")}-${makeId().slice(0, 6)}`,
    label,
    group,
    custom: true,
  };
}
