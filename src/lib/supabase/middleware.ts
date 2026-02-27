import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require auth
  const publicRoutes = ["/", "/login", "/auth/callback", "/auth/confirm", "/offline", "/schedule", "/speakers", "/sponsors"];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/") || pathname.startsWith("/auth/")
  );

  // If not authenticated and trying to access protected route, redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // If authenticated and on home or login page, redirect to schedule
  if (user && (pathname === "/" || pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/schedule";
    return NextResponse.redirect(url);
  }

  // For authenticated users, check profile completeness and role-based access
  if (user && (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/leads") ||
    // Check profile completeness for all non-excluded routes
    (!pathname.startsWith("/profile/complete") && !pathname.startsWith("/auth/") && !pathname.startsWith("/api/"))
  )) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, role, is_sponsor")
      .eq("id", user.id)
      .single();

    // Redirect incomplete profiles to complete their profile
    if (
      profile &&
      (!profile.first_name || !profile.last_name) &&
      !pathname.startsWith("/profile/complete") &&
      !pathname.startsWith("/auth/") &&
      !pathname.startsWith("/api/")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/profile/complete";
      return NextResponse.redirect(url);
    }

    // Admin route protection
    if (pathname.startsWith("/admin")) {
      if (!profile || !["admin", "staff"].includes(profile.role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/schedule";
        return NextResponse.redirect(url);
      }
    }

    // Sponsor leads route protection
    if (pathname.startsWith("/leads")) {
      if (!profile?.is_sponsor) {
        const url = request.nextUrl.clone();
        url.pathname = "/schedule";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
