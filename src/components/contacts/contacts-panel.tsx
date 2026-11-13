"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowUpRight, AtSign, Eye, MessageCircle, MoreHorizontal, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { PageHeader } from "@/components/common/page-header";
import { Segmented } from "@/components/common/segmented";
import { EmptyState } from "@/components/common/empty-state";
import { Tag } from "@/components/common/tag";
import { useContacts } from "@/lib/contacts/contacts-provider";
import { useSales } from "@/lib/sales/sales-provider";
import { useSettings } from "@/lib/settings/settings-provider";
import { useUI } from "@/components/providers/ui-provider";
import { ContactForm } from "@/components/contacts/contact-form";
import { ContactDetail } from "@/components/contacts/contact-detail";
import { ContactsKanban } from "@/components/contacts/contacts-kanban";
import { resolveStageId } from "@/lib/contacts/pipeline";
import { aggregateContactHistory } from "@/lib/sales/calculations";
import { formatCurrencyCents } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Contact } from "@/lib/contacts/types";

type View = "cartoes" | "funil" | "lista";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function whatsappHref(value: string): string | undefined {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return undefined;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

function instagramHref(value: string): string {
  return `https://instagram.com/${value.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}`;
}

const dateShort = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export function ContactsPanel() {
  const { contacts, deleteContact } = useContacts();
  const { sales } = useSales();
  const { settings } = useSettings();
  const { openDrawer, closeDrawer, confirm } = useUI();
  const [view, setView] = React.useState<View>("cartoes");
  const [search, setSearch] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState<string>("todos");
  const stages = settings.pipelineStages;
  const stageLabel = new Map(stages.map((s) => [s.id, s.label]));

  const stageOf = (c: Contact) => resolveStageId(c, stages);
  const countByStage = new Map<string, number>();
  for (const c of contacts) countByStage.set(stageOf(c), (countByStage.get(stageOf(c)) ?? 0) + 1);
  const openLeads = contacts.filter((c) => !["cliente", "perdido"].includes(stageOf(c))).length;
  const customers = countByStage.get("cliente") ?? 0;

  const bySearch = contacts.filter((c) => (search.trim() ? c.name.toLowerCase().includes(search.trim().toLowerCase()) : true));
  const filtered = bySearch.filter((c) => (stageFilter === "todos" ? true : stageOf(c) === stageFilter));

  function openCreate() {
    openDrawer({ title: "Novo contato", description: "Comece com o nome — você pode detalhar depois.", content: <ContactForm onDone={closeDrawer} /> });
  }
  function openEdit(contact: Contact) {
    openDrawer({ title: "Editar contato", content: <ContactForm contact={contact} onDone={closeDrawer} /> });
  }
  function openDetail(contact: Contact) {
    openDrawer({ title: contact.name, description: "Histórico e informações do contato.", content: <ContactDetail contact={contact} /> });
  }
  function handleDelete(contact: Contact) {
    confirm({
      title: "Excluir contato?",
      description: `"${contact.name}" será removido. O histórico de vendas já registrado é mantido, mas perde o vínculo com este contato.`,
      onConfirm: () => {
        deleteContact(contact.id);
        toast.success("Contato excluído.");
      },
    });
  }

  function actionsMenu(contact: Contact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Ações de ${contact.name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => openDetail(contact)}><Eye /> Ver histórico</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openEdit(contact)}>Editar</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => handleDelete(contact)}>Excluir</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const columns: DataTableColumn<Contact>[] = [
    { key: "name", header: "Nome", render: (row) => <button className="text-left hover:underline" onClick={() => openDetail(row)}>{row.name}</button> },
    { key: "whatsapp", header: "WhatsApp", render: (row) => row.whatsapp ?? "—" },
    { key: "instagram", header: "Instagram", render: (row) => row.instagram ?? "—" },
    { key: "stage", header: "Estágio", render: (row) => <Tag color="blue">{stageLabel.get(stageOf(row)) ?? "—"}</Tag> },
    {
      key: "tags",
      header: "Tags",
      render: (row) => (row.tags?.length ? <div className="flex flex-wrap gap-1">{row.tags.map((tag) => <Tag key={tag.id} color={tag.color}>{tag.label}</Tag>)}</div> : "—"),
    },
    { key: "actions", header: "", align: "right", render: (row) => actionsMenu(row) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Contatos"
        description="Clientes, leads e parceiros da marca."
        stats={[
          { value: String(openLeads), label: openLeads === 1 ? "lead em conversa" : "leads em conversa" },
          { value: String(customers), label: customers === 1 ? "cliente" : "clientes" },
        ]}
        action={
          <Button size="lg" onClick={openCreate}>
            <Plus className="size-4" /> Novo contato
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Visualização"
          value={view}
          onChange={setView}
          options={[
            { value: "cartoes", label: "Cartões" },
            { value: "funil", label: "Funil" },
            { value: "lista", label: "Lista" },
          ]}
        />
        <div className="relative w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar contato" aria-label="Buscar contato" className="h-11 rounded-full bg-card pl-8" />
        </div>
      </div>

      {view !== "funil" ? (
        <div role="radiogroup" aria-label="Estágio do funil" className="flex flex-wrap gap-1.5">
          {[{ id: "todos", label: "Todos", count: contacts.length }, ...stages.map((s) => ({ id: s.id, label: s.label, count: countByStage.get(s.id) ?? 0 }))]
            .filter((s) => s.id === "todos" || s.count > 0 || stageFilter === s.id)
            .map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={stageFilter === s.id}
                onClick={() => setStageFilter(s.id)}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-full border px-4 text-body transition-colors",
                  stageFilter === s.id ? "border-primary bg-primary text-primary-foreground" : "border-smoke bg-card hover:bg-paper-mist"
                )}
              >
                {s.label}
                <span className={cn("rounded-full px-2 text-caption font-semibold", stageFilter === s.id ? "bg-white/20" : "bg-paper-mist")}>{s.count}</span>
              </button>
            ))}
        </div>
      ) : null}

      {view === "funil" ? (
        <ContactsKanban contacts={bySearch} />
      ) : view === "lista" ? (
        <Card className="px-5">
          <DataTable columns={columns} data={filtered} emptyTitle="Nenhum contato aqui" emptyDescription="Troque o filtro ou crie um contato." />
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={contacts.length === 0 ? "Nenhum contato cadastrado" : "Nenhum contato neste estágio"}
          description={contacts.length === 0 ? "Nome e WhatsApp já bastam para começar." : "Troque o filtro ou a busca."}
          action={<Button onClick={openCreate}><Plus className="size-4" /> Novo contato</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((contact) => {
            const history = aggregateContactHistory(sales, contact.id);
            const stage = stageOf(contact);
            const isCustomer = stage === "cliente";
            const wa = contact.whatsapp ? whatsappHref(contact.whatsapp) : undefined;
            return (
              <Card key={contact.id} className="gap-4 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full font-display text-body-lg", isCustomer ? "brand-gradient" : "bg-paper-mist")}>
                      <span>{initials(contact.name)}</span>
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <button type="button" onClick={() => openDetail(contact)} className="truncate text-left font-display text-subheading hover:underline">
                        {contact.name}
                      </button>
                      <span className="text-caption text-muted-foreground">{stageLabel.get(stage) ?? "—"}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="outline" size="icon" aria-label={`Abrir ${contact.name}`} onClick={() => openDetail(contact)}>
                      <ArrowUpRight className="size-4" />
                    </Button>
                    {actionsMenu(contact)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {contact.whatsapp ? (
                    wa ? (
                      <a href={wa} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1.5 rounded-full bg-paper-mist px-3 text-caption hover:bg-sidebar-accent">
                        <MessageCircle className="size-3.5" /> {contact.whatsapp}
                      </a>
                    ) : (
                      <span className="flex h-8 items-center gap-1.5 rounded-full bg-paper-mist px-3 text-caption"><MessageCircle className="size-3.5" /> {contact.whatsapp}</span>
                    )
                  ) : null}
                  {contact.instagram ? (
                    <a href={instagramHref(contact.instagram)} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1.5 rounded-full bg-paper-mist px-3 text-caption hover:bg-sidebar-accent">
                      <AtSign className="size-3.5" /> {contact.instagram.replace(/^@/, "")}
                    </a>
                  ) : null}
                  {contact.tags?.map((tag) => <Tag key={tag.id} color={tag.color}>{tag.label}</Tag>)}
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-paper-mist p-3 text-center">
                  <div className="flex flex-col"><span className="font-display text-body-lg">{history.purchaseCount}</span><span className="text-caption text-muted-foreground">{history.purchaseCount === 1 ? "compra" : "compras"}</span></div>
                  <div className="flex flex-col"><span className="font-display text-body-lg">{history.totalPurchased > 0 ? formatCurrencyCents(history.totalPurchased) : "—"}</span><span className="text-caption text-muted-foreground">total</span></div>
                  <div className="flex flex-col"><span className="font-display text-body-lg">{history.lastPurchaseDate ? dateShort.format(new Date(history.lastPurchaseDate + "T00:00:00")) : "—"}</span><span className="text-caption text-muted-foreground">última</span></div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
