"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/lib/nav";
import {
  Plus,
  ShoppingBag,
  Package,
  Users,
  CheckSquare,
  Receipt,
} from "lucide-react";
import { useUI } from "@/components/providers/ui-provider";
import { useTasks } from "@/lib/tasks/tasks-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useContacts } from "@/lib/contacts/contacts-provider";
import { useSales } from "@/lib/sales/sales-provider";
import { describeSaleItems } from "@/lib/sales/calculations";
import { useFinance } from "@/lib/finance/finance-provider";
import { TaskForm } from "@/components/tasks/task-form";
import { ProductForm } from "@/components/catalog/product-form";
import { ContactDetail } from "@/components/contacts/contact-detail";
import { TransactionForm } from "@/components/finance/transaction-form";
import { formatCurrencyCents } from "@/lib/currency";

const RESULTS_PER_GROUP = 30;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { openDrawer, closeDrawer } = useUI();
  const { tasks } = useTasks();
  const { products } = useCatalog();
  const { contacts } = useContacts();
  const { sales } = useSales();
  const { transactions, categories } = useFinance();

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function open_(config: Parameters<typeof openDrawer>[0]) {
    onOpenChange(false);
    openDrawer(config);
  }

  const recentTasks = [...tasks].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, RESULTS_PER_GROUP);
  const recentProducts = [...products].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, RESULTS_PER_GROUP);
  const recentContacts = [...contacts].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, RESULTS_PER_GROUP);
  const recentSales = [...sales].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, RESULTS_PER_GROUP);
  const recentTransactions = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, RESULTS_PER_GROUP);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Busca global" description="Navegue, crie ou encontre qualquer registro">
      <Command>
        <CommandInput placeholder="Buscar tarefas, produtos, vendas, contatos, lançamentos..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Ações rápidas">
            <CommandItem onSelect={() => go("/vendas")}>
              <ShoppingBag /> Nova venda
            </CommandItem>
            <CommandItem onSelect={() => go("/produtos")}>
              <Package /> Novo produto
            </CommandItem>
            <CommandItem onSelect={() => go("/contatos")}>
              <Users /> Novo contato
            </CommandItem>
            <CommandItem onSelect={() => go("/tarefas")}>
              <CheckSquare /> Nova tarefa
            </CommandItem>
            <CommandItem onSelect={() => go("/canvas")}>
              <Plus /> Nova nota no canvas
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading="Navegar">
            {NAV_ITEMS.map((item) => (
              <CommandItem key={item.href} onSelect={() => go(item.href)}>
                <item.icon />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>

          {recentTasks.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Tarefas">
                {recentTasks.map((task) => (
                  <CommandItem
                    key={task.id}
                    value={`tarefa ${task.title}`}
                    onSelect={() => open_({ title: "Editar tarefa", content: <TaskForm task={task} onDone={closeDrawer} /> })}
                  >
                    <CheckSquare /> {task.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}

          {recentProducts.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Produtos">
                {recentProducts.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={`produto ${product.name}`}
                    onSelect={() => open_({ title: "Editar produto", content: <ProductForm product={product} onDone={closeDrawer} /> })}
                  >
                    <Package /> {product.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}

          {recentContacts.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Contatos">
                {recentContacts.map((contact) => (
                  <CommandItem
                    key={contact.id}
                    value={`contato ${contact.name}`}
                    onSelect={() => open_({ title: contact.name, description: "Histórico e informações do contato.", content: <ContactDetail contact={contact} /> })}
                  >
                    <Users /> {contact.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}

          {recentSales.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Vendas">
                {recentSales.map((sale) => {
                  const description = describeSaleItems(sale.items, (id) => products.find((p) => p.id === id)?.name);
                  const label = `${new Date(sale.date + "T00:00:00").toLocaleDateString("pt-BR")} — ${description} — ${formatCurrencyCents(sale.totalAmount)}`;
                  return (
                    <CommandItem key={sale.id} value={`venda ${label}`} onSelect={() => go("/vendas")}>
                      <ShoppingBag /> {label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          ) : null}

          {recentTransactions.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Lançamentos financeiros">
                {recentTransactions.map((transaction) => {
                  const categoryLabel = categories.find((c) => c.id === transaction.category)?.label ?? transaction.category;
                  return (
                    <CommandItem
                      key={transaction.id}
                      value={`lançamento ${transaction.description} ${categoryLabel}`}
                      onSelect={() =>
                        open_({ title: "Editar lançamento", content: <TransactionForm transaction={transaction} onDone={closeDrawer} /> })
                      }
                    >
                      <Receipt /> {transaction.description} — {formatCurrencyCents(transaction.amount)}
                      <span className="ml-auto text-caption text-muted-foreground">{categoryLabel}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
