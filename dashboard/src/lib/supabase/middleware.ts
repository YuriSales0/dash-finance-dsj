import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const demoMode = process.env.DEMO_MODE?.toLowerCase() !== "false";

  // Em demo: nao ha auth, libera tudo
  if (demoMode || !url || !key) return supabaseResponse;

  // Rotas publicas (login, auth callbacks): sem checagem
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  // Sem usuario: redirecionar para login
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Buscar role do usuario
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .single();

  if (!roleData || !roleData.is_active) {
    return NextResponse.redirect(new URL("/login?error=no_role", request.url));
  }

  const role = roleData.role as "dsj" | "investor";

  // Role-based routing
  if (pathname === "/" || pathname === "") {
    return NextResponse.redirect(
      new URL(role === "dsj" ? "/admin" : "/investor", request.url)
    );
  }
  if (pathname.startsWith("/admin") && role !== "dsj") {
    return NextResponse.redirect(new URL("/investor", request.url));
  }
  if (pathname.startsWith("/investor") && role !== "investor") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return supabaseResponse;
}
