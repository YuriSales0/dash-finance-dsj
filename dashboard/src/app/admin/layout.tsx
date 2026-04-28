import { Sidebar } from "@/components/layout/Sidebar";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Em demo: pula auth. Em prod: requer role dsj
  let userName: string | undefined;
  if (!isDemoMode) {
    const session = await getSession();
    if (!session) redirect("/login");
    if (session.role !== "dsj") redirect("/investor");
    userName = session.name;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar userName={userName} />
      <main className="flex-1 bg-slate-50 flex flex-col">
        {isDemoMode && <DemoBanner />}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
