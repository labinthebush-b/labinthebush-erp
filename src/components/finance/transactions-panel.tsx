"use client";

import * as React from "react";
import { toast } from "sonner";
import { MoreHorizontal, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Tag, type TagColor } from "@/components/common/tag";
import { StatusBadge, type Status } from "@/components/common/status-badge";
import { Combobox } from "@/components/common/combobox";
import type { Period } from "@/lib/finance/calculations";
import { useFinance } from "@/lib/finance/finance-provider";
import { useUI } from "@/components/providers/ui-provider";
import { TransactionForm } from "@/components/finance/transaction-form";
import { formatSignedCurrencyCents } from "@/lib/currency";
import { TRANSACTION_TYPE_LABELS, PAYMENT_SOURCE_LABELS } from "@/lib/finance/categories";
import type { Transaction, TransactionStatus, TransactionType } from "@/lib/finance/types";

const TYPE_TAG_COLOR: Record<TransactionType, TagColor> = {
  income: "green",
  expense: "orange",
  owner_contribution: "blue",
  owner_withdrawal: "violet",
};

function statusForBadge(status: TransactionStatus): Status {
  if (status === "concluido") return "concluido";
  if (status === "cancelado") return "cancelado";
  return "pendente";
}

/** Lista de lançamentos do período escolhido no topo do Financeiro (vazio = desde o início). */
export function TransactionsPanel({ period }: { period: Period }) {
  const { transactions, categories, setTransactionStatus, deleteTransaction, isMonthClosed } = useFinance();
  const { openDrawer, closeDrawer, confirm } = useUI();

  const [view, setView] = React.useState<"simples" | "detalhada">("simples");
  const [typeFilter, setTypeFilter] = React.useState<TransactionType | "todos">("todos");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<TransactionStatus | "todos">("todos");
  const [search, setSearch] = React.useState("");

  const categoryMap = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = transactions
    .filter((t) => (!period.start || t.date >= period.start) && (!period.end || t.date <= period.end))
    .filter((t) => (typeFilter === "todos" ? true : t.type === typeFilter))
    .filter((t) => (categoryFilter ? t.category === categoryFilter : true))
    .filter((t) => (statusFilter === "todos" ? true : t.status === statusFilter))
    .filter((t) =>
      search.trim() ? t.description.toLowerCase().includes(search.trim().toLowerCase()) : true
    )
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  function openEditDrawer(transaction: Transaction) {
    openDrawer({
      title: "Editar lançamento",
      description: "Ajuste os dados do lançamento.",
      content: <TransactionForm transaction={transaction} onDone={closeDrawer} />,
    });
  }

  function handleDelete(transaction: Transaction) {
    if (isMonthClosed(transaction.date)) {
      toast.error("Este mês está fechado. Reabra-o para excluir lançamentos.");
      return;
    }
    confirm({
      title: "Excluir lançamento?",
      description: `"${transaction.description}" será removido permanentemente do Financeiro.`,
      onConfirm: () => {
        deleteTransaction(transaction.id);
        toast.success("Lançamento excluído.");
      },
    });
  }

  function handleSettle(transaction: Transaction) {
    if (isMonthClosed(transaction.date)) {
      toast.error("Este mês está fechado. Reabra-o para confirmar lançamentos.");
      return;
    }
    setTransactionStatus(transaction.id, "concluido");
    toast.success("Lançamento confirmado.");
  }

  const baseColumns: DataTableColumn<Transaction>[] = [
    {
      key: "date",
      header: "Data",
      render: (row) => new Date(row.date + "T00:00:00").toLocaleDateString("pt-BR"),
    },
    {
      key: "description",
      header: "Descrição",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-foreground">
            {row.description}
            {row.installment ? (
              <span className="ml-1.5 text-caption text-muted-foreground">
                ({row.installment.number}/{row.installment.total})
              </span>
            ) : null}
          </span>
          {row.edited ? <span className="text-caption text-muted-foreground">*editado</span> : null}
        </div>
      ),
    },
    {
      key: "category",
      header: "Categoria",
      render: (row) => (
        <Tag color={TYPE_TAG_COLOR[row.type]}>{categoryMap.get(row.category)?.label ?? row.category}</Tag>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={statusForBadge(row.status)} />,
    },
    {
      key: "amount",
      header: "Valor",
      align: "right",
      render: (row) => {
        const isOutflow = row.type === "expense" || row.type === "owner_withdrawal";
        return (
          <span className={isOutflow ? "text-destructive" : "text-vivid-green"}>
            {formatSignedCurrencyCents(isOutflow ? -row.amount : row.amount)}
          </span>
        );
      },
    },
  ];

  const detailedColumns: DataTableColumn<Transaction>[] = [
    baseColumns[0],
    baseColumns[1],
    { key: "type", header: "Tipo", render: (row) => TRANSACTION_TYPE_LABELS[row.type] },
    baseColumns[2],
    { key: "paymentSource", header: "Pagamento", render: (row) => PAYMENT_SOURCE_LABELS[row.paymentSource] },
    baseColumns[3],
    baseColumns[4],
  ];

  const actionsColumn: DataTableColumn<Transaction> = {
    key: "actions",
    header: "",
    align: "right",
    render: (row) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Ações">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => openEditDrawer(row)}>Editar</DropdownMenuItem>
          {row.status === "pendente" ? (
            <DropdownMenuItem onSelect={() => handleSettle(row)}>Marcar como concluído</DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => handleDelete(row)}>
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  };

  const columns = [...(view === "detalhada" ? detailedColumns : baseColumns), actionsColumn];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição..."
            className="pl-8"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-44">
          <Combobox
            options={[{ value: "", label: "Todas as categorias" }, ...categories.map((c) => ({ value: c.id, label: c.label }))]}
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            placeholder="Categoria"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="ml-auto">
          <TabsList>
            <TabsTrigger value="simples">Simples</TabsTrigger>
            <TabsTrigger value="detalhada">Detalhada</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyTitle={transactions.length === 0 ? "Nenhuma movimentação registrada ainda" : "Nenhum lançamento encontrado"}
        emptyDescription={
          transactions.length === 0
            ? "Registre a primeira receita, despesa, aporte ou retirada para começar."
            : "Ajuste os filtros ou crie um novo lançamento."
        }
        emptyAction={
          transactions.length === 0 ? (
            <Button
              onClick={() =>
                openDrawer({
                  title: "Novo lançamento",
                  description: "Tipo → categoria → dados essenciais → salvar.",
                  content: <TransactionForm onDone={closeDrawer} />,
                })
              }
            >
              Novo lançamento
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
