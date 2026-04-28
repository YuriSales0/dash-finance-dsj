"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Users,
  Eye,
  Plug,
  FileText,
  CreditCard,
  Activity,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Visao Geral", icon: LayoutDashboard },
  { href: "/admin/risk", label: "Indice de Risco", icon: Activity },
  { href: "/admin/transactions", label: "Transacoes", icon: ArrowLeftRight },
  { href: "/admin/receivables", label: "Recebiveis", icon: FileText },
  { href: "/admin/debts", label: "Dividas", icon: CreditCard },
  { href: "/admin/pnl", label: "P&L Mensal", icon: TrendingUp },
  { href: "/admin/investments", label: "Investimentos", icon: Users },
  { href: "/admin/preview", label: "Preview Vitrine", icon: Eye },
  { href: "/admin/integrations", label: "Integracoes", icon: Plug },
];

interface Props {
  userName?: string;
}

export function Sidebar({ userName }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="text-xl font-bold">DSJ Finance</h1>
        <p className="text-slate-400 text-xs mt-1">Painel Admin</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-slate-700">
        {userName && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs text-slate-400">Logado como</p>
            <p className="text-sm font-medium text-white truncate">{userName}</p>
          </div>
        )}
        <form action="/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Sair
          </button>
        </form>
        <p className="text-slate-500 text-xs px-3 mt-2">v0.2.0</p>
      </div>
    </aside>
  );
}
