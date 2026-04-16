"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  TrendingUp,
  Users,
  Eye,
  BookOpen,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Visao Geral", icon: LayoutDashboard },
  { href: "/entity/dsj_network", label: "Por Empresa", icon: Building2 },
  { href: "/transactions", label: "Transacoes", icon: ArrowLeftRight },
  { href: "/pnl", label: "P&L", icon: TrendingUp },
  { href: "/investments", label: "Investimentos", icon: Users },
  { href: "/preview", label: "Preview Vitrine", icon: Eye },
  { href: "/rules", label: "Regras AI", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="text-xl font-bold">DSJ Finance</h1>
        <p className="text-slate-400 text-xs mt-1">AI-First Bookkeeping</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
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

      <div className="px-6 py-4 border-t border-slate-700">
        <p className="text-slate-500 text-xs">v0.1.0</p>
      </div>
    </aside>
  );
}
