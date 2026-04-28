import { cookies } from "next/headers";
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";

export async function getSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = cookies();

  const supabase = createSSRClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role, name, email, is_active")
    .eq("user_id", user.id)
    .single();

  if (!roleData?.is_active) return null;

  return {
    user,
    role: roleData.role as UserRole,
    name: roleData.name as string,
    email: (roleData.email as string) || user.email || "",
  };
}

export async function requireRole(role: UserRole | UserRole[]) {
  const session = await getSession();
  if (!session) redirect("/login");

  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(session.role)) {
    if (session.role === "dsj") redirect("/admin");
    if (session.role === "investor") redirect("/investor");
    redirect("/login");
  }

  return session;
}
