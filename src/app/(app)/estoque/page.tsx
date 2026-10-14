import { PageHeader } from "@/components/common/page-header";
import { StockPanel } from "@/components/stock/stock-panel";

export default function EstoquePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Estoque"
        description="Quantas peças existem de cada tamanho e cor. Cada venda baixa o estoque sozinha."
      />
      <StockPanel />
    </div>
  );
}
