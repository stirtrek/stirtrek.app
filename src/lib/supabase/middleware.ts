import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveEvent, resolveEventByDomain } from "@/lib/events/resolve";
import type { Event } from "@/lib/types";

// Default event slug used for backward-compat redirects on the platform domain
const DEFAULT_EVENT_SLUG = "stirtrek";

// Hosts that are the "platform" domain (not a custom tenant domain)
// Custom domains NOT in this list trigger domain-based resolution
const PLATFORM_HOSTS = ["localhost", "127.0.0.1"];

// Paths that are truly global (no event slug prefix)
const GLOBAL_PATHS = ["/offline", "/api/cron", "/api/profile", "/api/telemetry", "/api/debug", "/super-admin", "/api/super-admin"];

// Paths within an event that don't require auth
const PUBLIC_EVENT_PATHS = [
  "", // event landing page
  "/login",
  "/auth/callback",
  "/auth/confirm",
  "/schedule",
  "/speakers",
  "/sponsors",
];

/**
 * Legacy paths that old bookmarks/PWAs might use (slug-less).
 * On the platform domain, these redirect to include the default slug.
 * On custom domains, these are normal paths (no slug needed).
 */
const LEGACY_PATHS = [
  "/login",
  "/schedule",
  "/speakers",
  "/sponsors",
  "/polls",
  "/more",
  "/admin",
  "/emergency",
  "/movie-vote",
  "/my-schedule",
  "/profile",
  "/leads",
  "/venue-map",
  "/announcements",
  "/auth/callback",
  "/auth/confirm",
  "/profile/complete",
];

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Skip global/static paths ──
  if (GLOBAL_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return handleGlobalRoute(request);
  }

  // ── 2. Check for custom domain ──
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const isPlatformHost =
    PLATFORM_HOSTS.includes(hostname) ||
    hostname.endsWith(".vercel.app");

  let event: Event | null = null;
  let isCustomDomain = false;

  if (!isPlatformHost) {
    event = await resolveEventByDomain(host);
    if (event) {
      isCustomDomain = true;
    }
  }

  if (isCustomDomain && event) {
    return handleCustomDomain(request, event, pathname);
  }

  // ── 3. Platform domain: slug-based routing ──
  return handlePlatformDomain(request, pathname);
}

// ─────────────────────────────────────────────────────
// CUSTOM DOMAIN HANDLING
// e.g. stirtrek.app/schedule → internally /stirtrek/schedule
// ─────────────────────────────────────────────────────

async function handleCustomDomain(
  request: NextRequest,
  event: Event,
  pathname: string,
) {
  const slug = event.slug;

  // If path already starts with the slug, redirect to remove it
  // e.g. stirtrek.app/stirtrek/schedule → stirtrek.app/schedule
  if (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)) {
    const cleanPath = pathname.slice(slug.length + 1) || "/";
    const url = request.nextUrl.clone();
    url.pathname = cleanPath;
    return NextResponse.redirect(url);
  }

  // Set event ID header for downstream consumption
  request.headers.set("x-event-id", event.id);

  // Rewrite: prepend the slug so [eventSlug] routing works internally
  // User sees: stirtrek.app/schedule
  // App sees:  stirtrek.app/stirtrek/schedule (matched by [eventSlug])
  const internalPath = `/${slug}${pathname}`;
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = internalPath;

  // Run auth checks using the rewritten event path
  const eventPath = pathname; // On custom domain, pathname IS the event path

  // Set up Supabase client with cookie handling
  let supabaseResponse = NextResponse.rewrite(rewriteUrl, { request });

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
          supabaseResponse = NextResponse.rewrite(rewriteUrl, { request });
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

  // Skip auth for API routes
  if (eventPath.startsWith("/api/")) {
    return supabaseResponse;
  }

  // Check if public
  const isPublicRoute = PUBLIC_EVENT_PATHS.some(
    (route) =>
      eventPath === route ||
      eventPath.startsWith(route + "/") ||
      eventPath.startsWith("/auth/")
  );

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (eventPath === "/" || eventPath === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/schedule";
    return NextResponse.redirect(url);
  }

  // Profile + role checks
  if (
    user &&
    (eventPath.startsWith("/admin") ||
      eventPath.startsWith("/leads") ||
      (!eventPath.startsWith("/profile/complete") &&
        !eventPath.startsWith("/auth/") &&
        !eventPath.startsWith("/api/")))
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    if (
      profile &&
      (!profile.first_name || !profile.last_name) &&
      !eventPath.startsWith("/profile/complete") &&
      !eventPath.startsWith("/auth/") &&
      !eventPath.startsWith("/api/")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/profile/complete";
      return NextResponse.redirect(url);
    }

    if (eventPath.startsWith("/admin") || eventPath.startsWith("/leads")) {
      const { data: membership } = await supabase
        .from("event_memberships")
        .select("role, is_sponsor")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .single();

      if (eventPath.startsWith("/admin")) {
        if (!membership || !["admin", "staff"].includes(membership.role)) {
          const url = request.nextUrl.clone();
          url.pathname = "/schedule";
          return NextResponse.redirect(url);
        }
      }

      if (eventPath.startsWith("/leads")) {
        if (!membership?.is_sponsor) {
          const url = request.nextUrl.clone();
          url.pathname = "/schedule";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}

// ─────────────────────────────────────────────────────
// PLATFORM DOMAIN HANDLING
// e.g. app.example.com/stirtrek/schedule
// ─────────────────────────────────────────────────────

async function handlePlatformDomain(
  request: NextRequest,
  pathname: string,
) {
  // Handle legacy paths (no event slug) — redirect to default event
  const matchedLegacy = LEGACY_PATHS.find(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (matchedLegacy) {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_EVENT_SLUG}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Parse event slug from path
  const segments = pathname.split("/").filter(Boolean);
  const eventSlug = segments[0];

  if (!eventSlug) {
    return handleGlobalRoute(request);
  }

  const eventPath = "/" + segments.slice(1).join("/");

  // Resolve event and set header
  const event = await resolveEvent(eventSlug);
  if (event) {
    request.headers.set("x-event-id", event.id);
  }

  // Set up Supabase client
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
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

  // Skip auth for API routes
  if (eventPath.startsWith("/api/")) {
    return supabaseResponse;
  }

  const isPublicRoute = PUBLIC_EVENT_PATHS.some(
    (route) =>
      eventPath === route ||
      eventPath.startsWith(route + "/") ||
      eventPath.startsWith("/auth/")
  );

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = `/${eventSlug}/login`;
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (eventPath === "" || eventPath === "/" || eventPath === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = `/${eventSlug}/schedule`;
    return NextResponse.redirect(url);
  }

  if (
    user &&
    (eventPath.startsWith("/admin") ||
      eventPath.startsWith("/leads") ||
      (!eventPath.startsWith("/profile/complete") &&
        !eventPath.startsWith("/auth/") &&
        !eventPath.startsWith("/api/")))
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    if (
      profile &&
      (!profile.first_name || !profile.last_name) &&
      !eventPath.startsWith("/profile/complete") &&
      !eventPath.startsWith("/auth/") &&
      !eventPath.startsWith("/api/")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/${eventSlug}/profile/complete`;
      return NextResponse.redirect(url);
    }

    if (event && (eventPath.startsWith("/admin") || eventPath.startsWith("/leads"))) {
      const { data: membership } = await supabase
        .from("event_memberships")
        .select("role, is_sponsor")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .single();

      if (eventPath.startsWith("/admin")) {
        if (!membership || !["admin", "staff"].includes(membership.role)) {
          const url = request.nextUrl.clone();
          url.pathname = `/${eventSlug}/schedule`;
          return NextResponse.redirect(url);
        }
      }

      if (eventPath.startsWith("/leads")) {
        if (!membership?.is_sponsor) {
          const url = request.nextUrl.clone();
          url.pathname = `/${eventSlug}/schedule`;
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}

/**
 * Minimal session refresh for global routes (no event-scoped logic).
 */
async function handleGlobalRoute(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  createServerClient(
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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return supabaseResponse;
}
