import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";

export default async function RootPage() {
  // Em demo: vai direto para admin
  if (isDemoMode) redirect("/admin");

  // Em prod: checar sessao e role
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role === "dsj") redirect("/admin");
  if (session.role === "investor") redirect("/investor");

  redirect("/login");
}
