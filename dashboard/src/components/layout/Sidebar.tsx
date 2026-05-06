"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Users,
  Eye,
  Plug,
  FileText,
  ScrollText,
  CreditCard,
  Activity,
  Search,
  Upload,
  Link2,
  Settings,
  LogOut,
  Scale,
  Calendar,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/admin/calendar", label: "Calendário", icon: Calendar },
  { href: "/admin/risk", label: "Índice de Risco", icon: Activity },
  { href: "/admin/import", label: "Importar CSV", icon: Upload },
  { href: "/admin/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/admin/receivables", label: "Recebíveis", icon: FileText },
  { href: "/admin/debts", label: "Dívidas", icon: CreditCard },
  { href: "/admin/pnl", label: "P&L Mensal", icon: TrendingUp },
  { href: "/admin/investments", label: "Investimentos", icon: Users },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
];

interface Props {
  userName?: string;
}

export function Sidebar({ userName }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fechar drawer ao navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock scroll quando drawer aberto em mobile
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Topbar mobile com hamburger — visivel apenas <md */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-700">
        <div>
          <h1 className="text-base font-bold">DSJ Finance</h1>
          <p className="text-slate-400 text-[10px]">Painel Admin</p>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="p-2 rounded hover:bg-slate-800"
        >
          <Menu size={20} />
        </button>
      </div>
      {/* Spacer pra empurrar o content abaixo do topbar mobile */}
      <div className="md:hidden h-14 shrink-0" aria-hidden="true" />

      {/* Backdrop mobile */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — drawer em mobile, fixed em desktop */}
      <aside
        className={`bg-slate-900 text-white min-h-screen flex flex-col w-64
          md:relative md:translate-x-0
          fixed top-0 left-0 z-50 transition-transform duration-200
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="px-6 py-5 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">DSJ Finance</h1>
            <p className="text-slate-400 text-xs mt-1">Painel Admin</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="md:hidden p-1 rounded hover:bg-slate-800"
          >
            <X size={18} />
          </button>
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
    </>
  );
}
