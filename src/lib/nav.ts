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

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Financeiro", href: "/financeiro", icon: Wallet },
  { title: "Vendas", href: "/vendas", icon: ShoppingBag },
  { title: "Produtos", href: "/produtos", icon: Package },
  { title: "Estoque", href: "/estoque", icon: Boxes },
  { title: "Contatos", href: "/contatos", icon: Users },
  { title: "Tarefas", href: "/tarefas", icon: CheckSquare },
  { title: "Canvas", href: "/canvas", icon: PenTool },
  { title: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { title: "Configurações", href: "/configuracoes", icon: Settings },
];
