import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DSJ Finance - Portal do Investidor",
  description: "Plataforma privada de investimento",
  robots: { index: false, follow: false },
};

export default function InvestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">DSJ Finance</h1>
            <p className="text-xs text-slate-400">Portal do Investidor</p>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto py-8 px-6">{children}</main>
    </div>
  );
}
