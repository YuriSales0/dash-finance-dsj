import { isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { LayoutDashboard, FileText, Wallet, LogOut } from "lucide-react";

export const metadata: Metadata = {
  title: "DSJ Finance - Portal do Investidor",
  description: "Plataforma privada de investimento",
  robots: { index: false, follow: false },
};

export default async function InvestorLayout({ children }: { children: React.ReactNode }) {
  let userName = "Investidor demo";
  if (!isDemoMode) {
    const session = await getSession();
    if (!session) redirect("/login");
    if (session.role !== "investor") redirect("/admin");
    userName = session.name;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">DSJ Finance</h1>
            <p className="text-xs text-slate-400">Portal do Investidor</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 hidden md:inline">{userName}</span>
            <form action="/auth/logout" method="POST">
              <button type="submit" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                <LogOut size={14} />
                Sair
              </button>
            </form>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto px-6 flex gap-1 border-t border-slate-100 -mt-px">
          <NavLink href="/investor" icon={<LayoutDashboard size={14} />}>Visao geral</NavLink>
          <NavLink href="/investor/opportunities" icon={<FileText size={14} />}>Oportunidades</NavLink>
          <NavLink href="/investor/portfolio" icon={<Wallet size={14} />}>Meu portfolio</NavLink>
        </nav>
      </header>
      <main className="max-w-5xl mx-auto py-8 px-6">{children}</main>
    </div>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-2 border-b-2 border-transparent hover:border-brand-600"
    >
      {icon}
      {children}
    </Link>
  );
}
