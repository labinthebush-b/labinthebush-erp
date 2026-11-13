/**
 * Cabeçalho de página do redesign: título grande (Space Grotesk), uma linha
 * de contexto acima e, opcionalmente, números-chave ao lado do título
 * (`stats`) — como "34 negócios · 20 ganhos" nas referências.
 */
export function PageHeader({
  title,
  description,
  action,
  stats,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  stats?: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        <div className="flex flex-col gap-1">
          {description ? <p className="max-w-xl text-body text-muted-foreground">{description}</p> : null}
          <h1 className="font-display text-display text-foreground">{title}</h1>
        </div>
        {stats?.map((stat) => (
          <div key={stat.label} className="flex items-baseline gap-1.5">
            <span className="font-display text-heading-lg">{stat.value}</span>
            <span className="text-body text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
