import {
  LayoutDashboard,
  Wallet,
  ShoppingBag,
  Package,
  Boxes,
  Users,
  CheckSquare,
  PenTool,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  /** Sem rótulo = itens soltos no topo (ex.: Dashboard). */
  label?: string;
  items: NavItem[];
};

/** Menu lateral agrupado por área de trabalho, como num ERP. */
export const NAV_GROUPS: NavGroup[] = [
  { items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard }] },
  {
    label: "Comercial",
    items: [
      { title: "Vendas", href: "/vendas", icon: ShoppingBag },
      { title: "Contatos", href: "/contatos", icon: Users },
    ],
  },
  {
    label: "Produtos e estoque",
    items: [
      { title: "Produtos", href: "/produtos", icon: Package },
      { title: "Estoque", href: "/estoque", icon: Boxes },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", href: "/financeiro", icon: Wallet },
      { title: "Relatórios", href: "/relatorios", icon: BarChart3 },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Tarefas", href: "/tarefas", icon: CheckSquare },
      { title: "Canvas", href: "/canvas", icon: PenTool },
      { title: "Configurações", href: "/configuracoes", icon: Settings },
    ],
  },
];

/** Lista plana (busca, breadcrumbs, menu mobile) — mesma ordem do menu lateral. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
