"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/common/tag";
import { useSales } from "@/lib/sales/sales-provider";
import { useFinance } from "@/lib/finance/finance-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useContacts } from "@/lib/contacts/contacts-provider";
import { PAYMENT_LABELS, getSalePaymentStatus, indexTransactionsById } from "@/lib/sales/payment";
import {
  calculateDiscountsTotal,
  calculateItemsCost,
  calculateItemsSubtotal,
  calculateSaleContribution,
  calculateSaleProfit,
} from "@/lib/sales/calculations";
import { variantLabel } from "@/lib/stock/calculations";
import { formatCurrencyCents, formatSignedCurrencyCents } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS, CHANNEL_TAG_COLOR, PAYMENT_TAG_COLOR } from "@/components/sales/sale-labels";
import type { Sale } from "@/lib/sales/types";

function Row({ label, value, strong, muted }: { label: string; value: React.ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 text-body", strong && "font-medium")}>
      <span className={strong ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={cn("text-right", muted ? "text-muted-foreground" : "text-foreground")}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Detalhe de um pedido, aberto ao clicar numa venda da lista. Recebe só o id e
 * lê a venda ao vivo dos provedores, então "marcar como paga" atualiza este
 * painel na hora, sem precisar reabri-lo.
 */
export function SaleDetail({ saleId, onEdit }: { saleId: string; onEdit: (sale: Sale) => void }) {
  const { sales, setSalePayment } = useSales();
  const { transactions } = useFinance();
  const { getProduct } = useCatalog();
  const { getContact } = useContacts();

  const sale = sales.find((s) => s.id === saleId);
  const transactionsById = React.useMemo(() => indexTransactionsById(transactions), [transactions]);

  if (!sale) {
    return <p className="py-6 text-body text-muted-foreground">Esta venda não existe mais.</p>;
  }

  const status = getSalePaymentStatus(sale, transactionsById);
  const contact = sale.contactId ? getContact(sale.contactId) : undefined;
  const subtotal = calculateItemsSubtotal(sale.items);
  const discountAmount = calculateDiscountsTotal(subtotal, sale.discounts);
  const productsCost = calculateItemsCost(sale.items, getProduct);
  const profit = calculateSaleProfit(sale, getProduct);
  const contribution = calculateSaleContribution(sale, getProduct);
  const canTogglePayment = status === "pago" || status === "pendente";

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex flex-col gap-2">
        <span className="font-display text-heading text-foreground">{formatCurrencyCents(sale.totalAmount)}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Tag color={PAYMENT_TAG_COLOR[status]}>{PAYMENT_LABELS[status]}</Tag>
          <Tag color={CHANNEL_TAG_COLOR[sale.channel]}>{CHANNEL_LABELS[sale.channel]}</Tag>
          <span className="text-caption text-muted-foreground">
            {new Date(sale.date + "T00:00:00").toLocaleDateString("pt-BR")}
          </span>
        </div>
      </div>

      <Section title="Cliente">
        {contact ? (
          <div className="flex flex-col text-body">
            <span className="text-foreground">{contact.name}</span>
            <span className="text-caption text-muted-foreground">
              {[contact.whatsapp && `WhatsApp ${contact.whatsapp}`, contact.instagram && `@${contact.instagram.replace(/^@/, "")}`, contact.email]
                .filter(Boolean)
                .join(" · ") || "Sem dados de contato"}
            </span>
          </div>
        ) : (
          <span className="text-body text-muted-foreground">Sem cliente vinculado</span>
        )}
      </Section>

      <Section title="Itens">
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {sale.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-body">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-foreground">{getProduct(item.productId)?.name ?? "Produto removido"}</span>
                <span className="text-caption text-muted-foreground">
                  {item.size || item.color ? `${variantLabel(item)} · ` : ""}
                  {item.quantity} × {formatCurrencyCents(item.unitPrice)}
                </span>
              </div>
              <span className="shrink-0 text-foreground">{formatCurrencyCents(item.subtotal)}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Valores">
        <div className="flex flex-col gap-1.5 rounded-lg bg-paper-mist p-3">
          <Row label="Subtotal dos itens" value={formatCurrencyCents(subtotal)} />
          {discountAmount > 0 ? <Row label="Descontos" value={`− ${formatCurrencyCents(discountAmount)}`} /> : null}
          {sale.discounts.length > 0 ? (
            <p className="text-caption text-muted-foreground">
              {sale.discounts
                .map((d) => (d.code ? `${d.code}` : d.kind === "frete_gratis" ? "Frete grátis" : d.kind === "percentual" ? `${d.percent ?? 0}%` : "Desconto fixo"))
                .join(" + ")}
            </p>
          ) : null}
          <Row label="Frete cobrado do cliente" value={formatCurrencyCents(sale.shippingAmount ?? 0)} />
          <div className="border-t border-border pt-1.5">
            <Row label="Total da venda" value={formatCurrencyCents(sale.totalAmount)} strong />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
          <Row label="Custo dos produtos" value={formatCurrencyCents(productsCost)} />
          <Row label="Lucro (total − produtos)" value={formatSignedCurrencyCents(profit)} />
          {(sale.shippingCost ?? 0) > 0 ? <Row label="Custo real do frete" value={`− ${formatCurrencyCents(sale.shippingCost ?? 0)}`} muted /> : null}
          {(sale.nuvemshopFeeAmount ?? 0) > 0 ? <Row label="Taxa da Nuvemshop" value={`− ${formatCurrencyCents(sale.nuvemshopFeeAmount ?? 0)}`} muted /> : null}
          <div className="border-t border-border pt-1.5">
            <Row label="Resultado após frete e taxa" value={formatSignedCurrencyCents(contribution)} strong />
          </div>
        </div>
      </Section>

      {sale.notes ? (
        <Section title="Observações">
          <p className="whitespace-pre-wrap text-body text-foreground">{sale.notes}</p>
        </Section>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={() => onEdit(sale)}>
          Editar venda
        </Button>
        {canTogglePayment ? (
          <Button onClick={() => setSalePayment(sale.id, status === "pago" ? "pendente" : "pago")}>
            {status === "pago" ? "Voltar para “a receber”" : "Marcar como paga"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
