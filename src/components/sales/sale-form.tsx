"use client";

import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/common/currency-input";
import { DateInput } from "@/components/common/date-input";
import { Combobox } from "@/components/common/combobox";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DrawerForm, DrawerFormActions } from "@/components/common/drawer-form";
import { useContacts } from "@/lib/contacts/contacts-provider";
import { useSales } from "@/lib/sales/sales-provider";
import { useFinance } from "@/lib/finance/finance-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useStock } from "@/lib/stock/stock-provider";
import { findStockShortages, missingVariantChoice, variantLabel } from "@/lib/stock/calculations";
import { PAYMENT_LABELS, getSalePaymentStatus, indexTransactionsById, type SalePaymentInput } from "@/lib/sales/payment";
import { useSettings } from "@/lib/settings/settings-provider";
import { useUI } from "@/components/providers/ui-provider";
import { ContactForm } from "@/components/contacts/contact-form";
import { SaleItemsEditor } from "@/components/sales/sale-items-editor";
import { SaleDiscountsEditor } from "@/components/sales/sale-discounts-editor";
import { buildSaleItem, calculateSaleBreakdown, validateDiscounts } from "@/lib/sales/calculations";
import { formatCurrencyCents } from "@/lib/currency";
import type { Contact } from "@/lib/contacts/types";
import type { Discount, Sale, SaleItem, SalesChannel } from "@/lib/sales/types";

const CHANNEL_OPTIONS: { value: SalesChannel; label: string }[] = [
  { value: "nuvemshop", label: "Nuvemshop" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "outro", label: "Outro" },
];

function toISODate(date?: Date): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function SaleForm({ sale, onDone }: { sale?: Sale; onDone: () => void }) {
  const { contacts } = useContacts();
  const { addSale, updateSale } = useSales();
  const { settings } = useSettings();
  const { transactions } = useFinance();
  const { products } = useCatalog();
  const { movements } = useStock();
  const { openModal, closeModal } = useUI();
  const isEditing = Boolean(sale);
  // Itens que a venda já tinha antes desta edição — ver planSaleMovements.
  const previousItemIds = React.useMemo(() => new Set(sale?.items.map((item) => item.id) ?? []), [sale]);

  // "Pago"/"pendente" vem da transação de receita da venda (ver lib/sales/payment.ts).
  // Uma venda cancelada (ou sem lançamento) não é editável por aqui: o campo
  // fica como "pago" só como valor de exibição e nunca é enviado na edição.
  const initialPaymentStatus = sale ? getSalePaymentStatus(sale, indexTransactionsById(transactions)) : "pago";
  const paymentIsEditable = initialPaymentStatus === "pago" || initialPaymentStatus === "pendente";
  const [payment, setPayment] = React.useState<SalePaymentInput>(initialPaymentStatus === "pendente" ? "pendente" : "pago");

  const [date, setDate] = React.useState<Date | undefined>(toDate(sale?.date) ?? new Date());
  const [contactId, setContactId] = React.useState(sale?.contactId ?? "");
  const [items, setItems] = React.useState<SaleItem[]>(sale?.items?.length ? sale.items : [buildSaleItem({ productId: "", quantity: 1, unitPrice: 0 })]);
  const [discounts, setDiscounts] = React.useState<Discount[]>(sale?.discounts ?? []);
  const [channel, setChannel] = React.useState<SalesChannel>(sale?.channel ?? "nuvemshop");
  const [notes, setNotes] = React.useState(sale?.notes ?? "");
  const [shippingCost, setShippingCost] = React.useState(sale?.shippingCost ?? 0);

  // Opens the same Contact form used in Contatos, stacked on top of the sale
  // drawer via the modal slot — the sale form stays open behind it, and the
  // new contact comes back selected here without a second, duplicate form.
  function openNewContact() {
    openModal({
      title: "Novo contato",
      description: "Comece com o nome — você pode detalhar depois.",
      content: (
        <ContactForm
          onDone={closeModal}
          onCreated={(created: Contact) => setContactId(created.id)}
        />
      ),
    });
  }

  const breakdown = calculateSaleBreakdown({ items, discounts, shippingCost, channel, nuvemshopFeePercent: settings.nuvemshopFeePercent });
  const shortages = React.useMemo(
    () => findStockShortages({ items, movements, editingSaleId: sale?.id, previousItemIds }),
    [items, movements, sale?.id, previousItemIds]
  );

  function handleSubmit() {
    if (items.length === 0 || items.some((item) => !item.productId)) {
      toast.error("Selecione o produto de cada item da venda.");
      return;
    }
    // Itens novos precisam dizer qual tamanho/cor saiu — é daí que o estoque baixa.
    // Itens que a venda já tinha (registrados antes do estoque) não são forçados.
    for (const item of items) {
      if (previousItemIds.has(item.id)) continue;
      const product = products.find((p) => p.id === item.productId);
      const missing = missingVariantChoice(product, item);
      if (product && missing) {
        toast.error(missing === "cor" ? `Escolha a cor de “${product.name}”.` : `Escolha o tamanho de “${product.name}”.`);
        return;
      }
    }
    if (!date) {
      toast.error("Selecione a data da venda.");
      return;
    }
    if (breakdown.subtotal <= 0) {
      toast.error("Informe ao menos um item com valor.");
      return;
    }
    const discountsError = validateDiscounts(discounts);
    if (discountsError) {
      toast.error(discountsError);
      return;
    }

    const payload = {
      date: toISODate(date),
      contactId: contactId || undefined,
      items,
      discounts,
      shippingCost,
      channel,
      notes: notes || undefined,
      payment: paymentIsEditable ? payment : undefined,
    };

    if (isEditing && sale) {
      updateSale(sale.id, payload);
      toast.success("Venda atualizada — o Financeiro foi recalculado.");
    } else {
      addSale(payload);
      toast.success(
        payment === "pendente"
          ? "Venda registrada — o valor ficou em “A receber” no Financeiro."
          : "Venda registrada — a receita já entrou no Financeiro."
      );
    }
    onDone();
  }

  return (
    <>
      <DrawerForm>
        <Field label="Data">
          <DateInput value={date} onValueChange={setDate} />
        </Field>

        <Field label="Cliente/contato" optional>
          <Combobox
            options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            value={contactId}
            onValueChange={setContactId}
            placeholder="Selecionar contato"
            onCreateNew={openNewContact}
            createLabel="Adicionar novo contato"
          />
        </Field>

        <Field label="Produtos" hint="Adicione um ou mais produtos — o subtotal de cada um é sempre quantidade × preço unitário.">
          <SaleItemsEditor items={items} onChange={setItems} />
        </Field>

        {shortages.length > 0 ? (
          <div role="alert" className="flex flex-col gap-1 rounded-lg border border-[#fcd34d] bg-[#fef3c7] p-3 text-caption text-[#92400e]">
            <span className="font-medium">Estoque insuficiente</span>
            {shortages.map((shortage) => (
              <span key={`${shortage.productId}-${shortage.size ?? ""}-${shortage.color ?? ""}`}>
                {products.find((p) => p.id === shortage.productId)?.name ?? "Produto"} ({variantLabel(shortage)}): pedido {shortage.requested},{" "}
                em estoque {Math.max(shortage.available, 0)}.
              </span>
            ))}
            <span>Você pode registrar a venda mesmo assim — o estoque fica negativo até a próxima entrada.</span>
          </div>
        ) : null}

        <Field label="Frete" optional hint="Custo real de frete para a marca. Cobrado do cliente, a menos que haja um desconto de frete grátis.">
          <CurrencyInput value={shippingCost} onValueChange={setShippingCost} />
        </Field>

        <CollapsibleSection label="Adicionar cupom/desconto" defaultOpen={discounts.length > 0}>
          <SaleDiscountsEditor discounts={discounts} onChange={setDiscounts} />
        </CollapsibleSection>

        <div className="flex flex-col gap-1.5 rounded-lg bg-paper-mist p-3">
          <div className="flex justify-between text-body">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">{formatCurrencyCents(breakdown.subtotal)}</span>
          </div>
          {breakdown.discountAmount > 0 ? (
            <div className="flex justify-between text-body">
              <span className="text-muted-foreground">Descontos concedidos</span>
              <span className="text-destructive">− {formatCurrencyCents(breakdown.discountAmount)}</span>
            </div>
          ) : null}
          {shippingCost > 0 ? (
            <div className="flex justify-between text-body">
              <span className="text-muted-foreground">Frete cobrado do cliente</span>
              <span className="text-foreground">{formatCurrencyCents(breakdown.shippingAmount)}</span>
            </div>
          ) : null}
          {shippingCost > 0 && breakdown.shippingAmount !== shippingCost ? (
            <div className="flex justify-between text-caption text-muted-foreground">
              <span>Custo de frete para a marca (não cobrado)</span>
              <span>{formatCurrencyCents(shippingCost)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-1.5 text-body-lg font-medium">
            <span className="text-foreground">Total pago pelo cliente</span>
            <span className="text-foreground">{formatCurrencyCents(breakdown.totalAmount)}</span>
          </div>
          {breakdown.nuvemshopFeeAmount > 0 ? (
            <div className="flex justify-between text-caption text-muted-foreground">
              <span>Taxa Nuvemshop ({settings.nuvemshopFeePercent}%) — custo do canal, não reduz a receita</span>
              <span>{formatCurrencyCents(breakdown.nuvemshopFeeAmount)}</span>
            </div>
          ) : null}
          {channel === "nuvemshop" && settings.nuvemshopFeePercent === 0 ? (
            <p className="text-caption text-muted-foreground">
              Taxa da Nuvemshop ainda não configurada — defina em Configurações para que ela entre no cálculo.
            </p>
          ) : null}
        </div>

        <Field label="Canal">
          <Select value={channel} onValueChange={(value) => setChannel(value as SalesChannel)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CHANNEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {paymentIsEditable ? (
          <Field
            label="Pagamento"
            hint="Pendente entra em “A receber” no Financeiro e só vira caixa quando você marcar a venda como paga."
          >
            <Select value={payment} onValueChange={(value) => setPayment(value as SalePaymentInput)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente — a receber</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <p className="text-caption text-muted-foreground">
            O pagamento desta venda está como “{PAYMENT_LABELS[initialPaymentStatus]}” no Financeiro e não é alterado por aqui.
          </p>
        )}

        <Field label="Observações" optional>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </DrawerForm>
      <DrawerFormActions
        onCancel={onDone}
        onSubmit={handleSubmit}
        submitLabel={isEditing ? "Salvar alterações" : "Registrar venda"}
      />
    </>
  );
}
