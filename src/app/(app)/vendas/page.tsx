import { PageHeader } from "@/components/common/page-header";
import { SalesPanel } from "@/components/sales/sales-panel";

export default function VendasPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vendas"
        description="Pedidos dos canais Nuvemshop, Instagram e WhatsApp — pagamento, receita e lucro de cada venda."
      />
      <SalesPanel />
    </div>
  );
}
