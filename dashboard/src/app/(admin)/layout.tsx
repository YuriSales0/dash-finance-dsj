import { Sidebar } from "@/components/layout/Sidebar";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { isDemoMode } from "@/lib/data/repository";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 bg-slate-50 flex flex-col">
        {isDemoMode && <DemoBanner />}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
