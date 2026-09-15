// Domain types for the Vendas module (Phase 3, extended for múltiplos
// produtos/descontos e taxa de canal).
// A Sale never stores money logic of its own — it feeds the existing Financeiro
// Transaction abstraction (see buildIncomeTransactionInput in calculations.ts).

export type SalesChannel = "nuvemshop" | "instagram" | "whatsapp" | "outro";

export type DiscountKind = "percentual" | "valor_fixo" | "frete_gratis";

export type Discount = {
  kind: DiscountKind;
  code?: string;
  description?: string;
  /** 0-100. Só é usado quando kind é "percentual". */
  percent?: number;
  /** Centavos. Só é usado quando kind é "valor_fixo". */
  amount?: number;
  /** Se este cupom pode ser combinado com outras promoções (informativo, não afeta o cálculo). */
  acumulativo?: boolean;
};

export type SaleItem = {
  id: string;
  productId: string;
  quantity: number;
  /** Preço unitário no momento da venda, em centavos — sugerido a partir do produto, editável. */
  unitPrice: number;
  /** Sempre `quantity * unitPrice` — nunca digitado à parte (ver buildSaleItem em calculations.ts), então não existe estado inconsistente entre os três. */
  subtotal: number;
};

export type Sale = {
  id: string;
  date: string; // ISO yyyy-MM-dd
  contactId?: string;
  /** Um ou mais produtos da venda. Vendas registradas antes desta versão (um produto só) chegam aqui já normalizadas para um item — ver lib/sales/repository.ts. */
  items: SaleItem[];
  /** Descontos acumulados (0, 1 ou mais) — ver calculateDiscountsTotal. No máximo um pode ser "frete_gratis". */
  discounts: Discount[];
  /** Frete efetivamente cobrado do cliente, em centavos. Zero quando algum desconto é frete grátis. */
  shippingAmount?: number;
  /** Custo real do frete para a marca, em centavos — pode ser maior que o cobrado (ex: frete grátis concedido ao cliente). */
  shippingCost?: number;
  /**
   * Taxa do canal Nuvemshop sobre esta venda, em centavos — calculada e
   * congelada no momento do registro/edição a partir de Configurações →
   * nuvemshopFeePercent, para que uma mudança futura na taxa configurada não
   * altere retroativamente vendas já registradas. Ausente/0 quando o canal
   * não é "nuvemshop" ou a taxa configurada é 0.
   */
  nuvemshopFeeAmount?: number;
  /** Valor final pago pelo cliente = subtotal − descontos + frete cobrado. É o que vira receita no Financeiro. */
  totalAmount: number; // cents
  channel: SalesChannel;
  notes?: string;
  /** Id of the Transaction (lib/finance) created to register this sale's revenue. */
  transactionId: string;
  /** Id of the Transaction (lib/finance) created to register the real shipping cost as an expense, if any (absent when there's no shippingCost). */
  shippingTransactionId?: string;
  /** Id of the Transaction (lib/finance) created to register the Nuvemshop channel fee as an expense, if any. */
  nuvemshopFeeTransactionId?: string;
  createdAt: string;
  updatedAt: string;
};
