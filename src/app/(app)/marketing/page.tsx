import { PageHeader } from "@/components/common/page-header";
import { MarketingPanel } from "@/components/marketing/marketing-panel";

export default function MarketingPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Marketing"
        description="Site (Google Analytics) e Instagram ao lado das vendas do ERP, no mesmo período."
      />
      <MarketingPanel />
    </div>
  );
}
