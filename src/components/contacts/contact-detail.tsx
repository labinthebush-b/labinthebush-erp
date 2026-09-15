"use client";

import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Tag } from "@/components/common/tag";
import { formatCurrencyCents } from "@/lib/currency";
import { useSales } from "@/lib/sales/sales-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useTasks } from "@/lib/tasks/tasks-provider";
import { useSettings } from "@/lib/settings/settings-provider";
import { useUI } from "@/components/providers/ui-provider";
import { PriorityBadge } from "@/components/common/priority-badge";
import { TaskForm } from "@/components/tasks/task-form";
import { aggregateContactHistory, describeSaleItems } from "@/lib/sales/calculations";
import { resolveStageId } from "@/lib/contacts/pipeline";
import type { Contact } from "@/lib/contacts/types";
import type { Sale } from "@/lib/sales/types";

export function ContactDetail({ contact }: { contact: Contact }) {
  const { sales } = useSales();
  const { getProduct } = useCatalog();
  const { tasks } = useTasks();
  const { settings } = useSettings();
  const { openDrawer, closeDrawer } = useUI();
  const contactSales = sales.filter((s) => s.contactId === contact.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const history = aggregateContactHistory(sales, contact.id);
  const relatedTasks = tasks.filter((t) => t.relations?.contactId === contact.id);
  const stageLabel = settings.pipelineStages.find((s) => s.id === resolveStageId(contact, settings.pipelineStages))?.label;

  const columns: DataTableColumn<Sale>[] = [
    { key: "date", header: "Data", render: (row) => new Date(row.date + "T00:00:00").toLocaleDateString("pt-BR") },
    { key: "product", header: "Produto", render: (row) => describeSaleItems(row.items, (id) => getProduct(id)?.name) },
    { key: "quantity", header: "Qtd", align: "right", render: (row) => row.items.reduce((sum, item) => sum + item.quantity, 0) },
    { key: "total", header: "Valor", align: "right", render: (row) => formatCurrencyCents(row.totalAmount) },
  ];

  function openFollowUp() {
    openDrawer({
      title: "Novo follow-up",
      description: "Cria uma tarefa para lembrar de falar com esse contato de novo.",
      content: (
        <TaskForm
          defaultTitle={`Falar com ${contact.name} novamente`}
          defaultContactId={contact.id}
          onDone={closeDrawer}
        />
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {stageLabel ? <Tag color="blue">{stageLabel}</Tag> : null}
        {contact.whatsapp ? <Tag color="green">{contact.whatsapp}</Tag> : null}
        {contact.instagram ? <Tag color="violet">{contact.instagram}</Tag> : null}
        {contact.email ? <Tag color="neutral">{contact.email}</Tag> : null}
        {contact.tags?.map((tag) => <Tag key={tag.id} color={tag.color}>{tag.label}</Tag>)}
      </div>

      <Button variant="outline" size="sm" className="w-fit" onClick={openFollowUp}>
        <UserPlus className="size-3.5" />
        Novo follow-up
      </Button>

      <div className="grid grid-cols-3 gap-3 rounded-lg bg-paper-mist p-3 text-center">
        <div>
          <p className="text-caption text-muted-foreground">Total comprado</p>
          <p className="text-body-lg font-medium text-foreground">{formatCurrencyCents(history.totalPurchased)}</p>
        </div>
        <div>
          <p className="text-caption text-muted-foreground">Compras</p>
          <p className="text-body-lg font-medium text-foreground">{history.purchaseCount}</p>
        </div>
        <div>
          <p className="text-caption text-muted-foreground">Última compra</p>
          <p className="text-body-lg font-medium text-foreground">
            {history.lastPurchaseDate
              ? new Date(history.lastPurchaseDate + "T00:00:00").toLocaleDateString("pt-BR")
              : "—"}
          </p>
        </div>
      </div>

      {contact.customFields.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-body font-medium text-foreground">Campos personalizados</span>
          {contact.customFields.map((field) => (
            <div key={field.id} className="flex justify-between text-body">
              <span className="text-muted-foreground">{field.label}</span>
              <span className="text-foreground">{field.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div>
        <span className="mb-2 block text-body font-medium text-foreground">Histórico de vendas</span>
        <DataTable
          columns={columns}
          data={contactSales}
          emptyTitle="Sem vendas ainda"
          emptyDescription="Quando esse contato comprar, as vendas aparecem aqui."
        />
      </div>

      {relatedTasks.length > 0 ? (
        <div>
          <span className="mb-2 block text-body font-medium text-foreground">Tarefas relacionadas</span>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {relatedTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-body text-foreground">{task.title}</span>
                {task.priority ? <PriorityBadge priority={task.priority} /> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
