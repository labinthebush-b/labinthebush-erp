"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrencyCents } from "@/lib/currency";
import { calculateResultado, type Period } from "@/lib/finance/calculations";
import { useFinance } from "@/lib/finance/finance-provider";
import { cn } from "@/lib/utils";

function ResultLine({
  label,
  value,
  emphasis,
  negative,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2.5",
        emphasis ? "border-t border-foreground/80 pt-3 font-display text-body-xl" : "border-t border-border text-body"
      )}
    >
      <span className={emphasis ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={cn(emphasis ? "text-foreground" : "text-foreground", negative && "text-destructive")}>
        {negative ? "− " : ""}
        {formatCurrencyCents(value)}
      </span>
    </div>
  );
}

export function ResultadoPanel({ period, className }: { period: Period; className?: string }) {
  const { transactions, categories } = useFinance();
  const resultado = calculateResultado(transactions, period, categories);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="font-display text-subheading">Resultado</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        <ResultLine label="Receita" value={resultado.receita} />
        <ResultLine label="Custo dos produtos" value={resultado.custoProdutos} negative />
        <ResultLine label="Lucro bruto" value={resultado.lucroBruto} emphasis />
        <ResultLine label="Despesas operacionais" value={resultado.despesasOperacionais} negative />
        <ResultLine label="Lucro líquido" value={resultado.lucroLiquido} emphasis />
        <p className="mt-3 text-caption text-muted-foreground">
          Aportes e retiradas não entram neste cálculo — eles afetam apenas o capital do proprietário.
        </p>
      </CardContent>
    </Card>
  );
}
