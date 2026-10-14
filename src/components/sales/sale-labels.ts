import type { TagColor } from "@/components/common/tag";
import type { SalePaymentStatus } from "@/lib/sales/payment";
import type { SalesChannel } from "@/lib/sales/types";

// Rótulos e cores compartilhados entre a lista de vendas e o detalhe do pedido.

export const CHANNEL_TAG_COLOR: Record<SalesChannel, TagColor> = {
  nuvemshop: "blue",
  instagram: "violet",
  whatsapp: "green",
  outro: "neutral",
};

export const CHANNEL_LABELS: Record<SalesChannel, string> = {
  nuvemshop: "Nuvemshop",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  outro: "Outro",
};

export const PAYMENT_TAG_COLOR: Record<SalePaymentStatus, TagColor> = {
  pago: "green",
  pendente: "orange",
  cancelado: "neutral",
  sem_lancamento: "neutral",
};
