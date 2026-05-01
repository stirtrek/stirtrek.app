import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  resolveEvent,
  resolveEventByDomain,
  ensureEventMembership,
} from "@/lib/events/resolve";
import type { Event } from "@/lib/types";

// Default event slug used for backward-compat redirects on the platform domain
const DEFAULT_EVENT_SLUG = "stirtrek";

// Hosts that are the "platform" domain (not a custom tenant domain)
// Custom domains NOT in this list trigger domain-based resolution
const PLATFORM_HOSTS = ["localhost", "127.0.0.1"];

// Domains that serve the marketing homepage AND event apps by slug
const MARKETING_HOSTS = ["conferenceday.app", "www.conferenceday.app"];

// Paths on the marketing domain that should render marketing pages
// Everything else falls through to slug-based event routing
const MARKETING_PATHS = ["/", "/pricing"];

// Paths that are truly global (no event slug prefix)
const GLOBAL_PATHS = ["/offline", "/api/cron", "/api/profile", "/api/telemetry", "/api/apple-touch-icon", "/api/public", "/api/auth", "/super-admin", "/api/super-admin", "/create-event", "/api/checkout", "/api/webhooks"];

// Paths within an event that don't require auth
const PUBLIC_EVENT_PATHS = [
  "", // event landing page
  "/login",
  "/auth/callback",
  "/auth/confirm",
  "/browse",
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
  "/my-schedule",
  "/profile",
  "/leads",
  "/venue-map",
  "/announcements",
  "/proctor",
  "/auth/callback",
  "/auth/confirm",
  "/profile/complete",
];

/**
 * Create a redirect that preserves any auth cookies set during this
 * middleware run (e.g. refreshed access/refresh tokens). Without this,
 * a token refresh followed by a redirect would drop the new cookies,
 * and the browser would follow the redirect with stale tokens —
 * causing the user to appear logged-out.
 */
function redirectWithCookies(
  url: URL,
  supabaseResponse: NextResponse,
): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of supabaseResponse.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Skip global/static paths ──
  if (GLOBAL_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return handleGlobalRoute(request);
  }

  // ── 2. Check for marketing domain ──
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();

  if (MARKETING_HOSTS.includes(hostname)) {
    const isMarketingPath = MARKETING_PATHS.includes(pathname);
    if (isMarketingPath) {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = `/marketing${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(rewriteUrl, { request });
    }
    // Fall through to platform domain handling for event slugs
  }

  // ── 3. Check for custom domain ──
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
    return redirectWithCookies(url, supabaseResponse);
  }

  // Backstop: ensure every authenticated user has an event_memberships row
  // for this event. Catches the case where the post-auth /api/join call
  // failed silently (cookie propagation race, network blip, etc.) and the
  // user is logged in but never got a membership row.
  if (user && !eventPath.startsWith("/auth/")) {
    await ensureEventMembership(event.id, user.id);
  }

  if (user && (eventPath === "/" || eventPath === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/schedule";
    return redirectWithCookies(url, supabaseResponse);
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
    const needsMembership =
      eventPath.startsWith("/admin") ||
      eventPath.startsWith("/leads") ||
      eventPath.startsWith("/proctor");

    // Fetch profile (with is_super_admin) and membership in parallel
    // to avoid a sequential waterfall on the hot auth path.
    const profilePromise = supabase
      .from("profiles")
      .select("first_name, last_name, is_super_admin")
      .eq("id", user.id)
      .single();

    const membershipPromise = needsMembership
      ? supabase
          .from("event_memberships")
          .select("role, is_sponsor")
          .eq("event_id", event.id)
          .eq("user_id", user.id)
          .single()
      : Promise.resolve({ data: null });

    const [{ data: profile }, { data: membership }] = await Promise.all([
      profilePromise,
      membershipPromise,
    ]);

    if (
      profile &&
      (!profile.first_name || !profile.last_name) &&
      !eventPath.startsWith("/profile/complete") &&
      !eventPath.startsWith("/auth/") &&
      !eventPath.startsWith("/api/")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/profile/complete";
      return redirectWithCookies(url, supabaseResponse);
    }

    if (needsMembership) {
      if (eventPath.startsWith("/admin")) {
        if (
          (!membership || !["admin", "staff"].includes(membership.role)) &&
          !profile?.is_super_admin
        ) {
          const url = request.nextUrl.clone();
          url.pathname = "/schedule";
          return redirectWithCookies(url, supabaseResponse);
        }
      }

      if (eventPath.startsWith("/proctor")) {
        if (
          (!membership || !["admin", "staff", "proctor"].includes(membership.role)) &&
          !profile?.is_super_admin
        ) {
          const url = request.nextUrl.clone();
          url.pathname = "/schedule";
          return redirectWithCookies(url, supabaseResponse);
        }
      }

      if (eventPath.startsWith("/leads")) {
        if (!membership?.is_sponsor) {
          const url = request.nextUrl.clone();
          url.pathname = "/schedule";
          return redirectWithCookies(url, supabaseResponse);
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
    return redirectWithCookies(url, supabaseResponse);
  }

  // Backstop: ensure every authenticated user has an event_memberships row
  // for this event. Catches the case where the post-auth /api/join call
  // failed silently (cookie propagation race, network blip, etc.) and the
  // user is logged in but never got a membership row.
  if (user && event && !eventPath.startsWith("/auth/")) {
    await ensureEventMembership(event.id, user.id);
  }

  if (user && (eventPath === "" || eventPath === "/" || eventPath === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = `/${eventSlug}/schedule`;
    return redirectWithCookies(url, supabaseResponse);
  }

  if (
    user &&
    (eventPath.startsWith("/admin") ||
      eventPath.startsWith("/leads") ||
      (!eventPath.startsWith("/profile/complete") &&
        !eventPath.startsWith("/auth/") &&
        !eventPath.startsWith("/api/")))
  ) {
    const needsMembership =
      !!event &&
      (eventPath.startsWith("/admin") ||
        eventPath.startsWith("/leads") ||
        eventPath.startsWith("/proctor"));

    // Fetch profile (with is_super_admin) and membership in parallel.
    const profilePromise = supabase
      .from("profiles")
      .select("first_name, last_name, is_super_admin")
      .eq("id", user.id)
      .single();

    const membershipPromise = needsMembership
      ? supabase
          .from("event_memberships")
          .select("role, is_sponsor")
          .eq("event_id", event!.id)
          .eq("user_id", user.id)
          .single()
      : Promise.resolve({ data: null });

    const [{ data: profile }, { data: membership }] = await Promise.all([
      profilePromise,
      membershipPromise,
    ]);

    if (
      profile &&
      (!profile.first_name || !profile.last_name) &&
      !eventPath.startsWith("/profile/complete") &&
      !eventPath.startsWith("/auth/") &&
      !eventPath.startsWith("/api/")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/${eventSlug}/profile/complete`;
      return redirectWithCookies(url, supabaseResponse);
    }

    if (needsMembership) {
      if (eventPath.startsWith("/admin")) {
        if (
          (!membership || !["admin", "staff"].includes(membership.role)) &&
          !profile?.is_super_admin
        ) {
          const url = request.nextUrl.clone();
          url.pathname = `/${eventSlug}/schedule`;
          return redirectWithCookies(url, supabaseResponse);
        }
      }

      if (eventPath.startsWith("/proctor")) {
        if (
          (!membership || !["admin", "staff", "proctor"].includes(membership.role)) &&
          !profile?.is_super_admin
        ) {
          const url = request.nextUrl.clone();
          url.pathname = `/${eventSlug}/schedule`;
          return redirectWithCookies(url, supabaseResponse);
        }
      }

      if (eventPath.startsWith("/leads")) {
        if (!membership?.is_sponsor) {
          const url = request.nextUrl.clone();
          url.pathname = `/${eventSlug}/schedule`;
          return redirectWithCookies(url, supabaseResponse);
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

  // Must call getUser() to trigger session refresh and cookie update
  await supabase.auth.getUser();

  return supabaseResponse;
}
