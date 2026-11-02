import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/config";
import { createRateLimiter, isLikelyBot } from "@/lib/share";

const PUBLIC_PATHS = ["/login"];

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // Fixture gallery for development; the page itself answers 404 in production.
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/dev/")) return true;
  // PWA assets must be reachable without a session.
  if (pathname === "/manifest.webmanifest" || pathname === "/sw.js" || pathname.startsWith("/icons/") || pathname === "/icon.svg" || pathname === "/apple-icon.png") return true;
  return false;
}

const shareRateLimit = createRateLimiter(120, 60_000);

/** Public share links skip the session entirely. Only here can a page load be marked as a countable view. */
function shareResponse(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!shareRateLimit(ip)) return new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
  const headers = new Headers(request.headers);
  // Whatever a visitor sends in this header is thrown away.
  headers.delete("x-share-count");
  const { pathname, searchParams } = request.nextUrl;
  const isPage = /^\/s\/[^/]+\/?$/.test(pathname);
  const prefetch = request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch" || request.headers.get("sec-purpose")?.includes("prefetch");
  if (isPage && request.method === "GET" && !prefetch && !searchParams.has("preview") && !isLikelyBot(request.headers.get("user-agent"))) headers.set("x-share-count", "1");
  return NextResponse.next({ request: { headers } });
}

/** Refreshes the Supabase session cookie and redirects anonymous visitors to /login. */
export async function updateSession(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/s/")) return shareResponse(request);

  // Without credentials the app renders a "Setup required" screen instead of crashing.
  if (!isSupabaseConfigured) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  // Two-factor enrolled but not passed in this session. This is the friendly part; the database
  // enforces the same rule (migration 004), since the API can be called without passing through here.
  let needsMfa = false;
  if (signedIn && !isPublic(pathname)) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    needsMfa = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
  }

  // API routes answer 401 themselves; never redirect them to an HTML page.
  if (pathname.startsWith("/api/")) return needsMfa ? NextResponse.json({ error: "Two-factor verification required" }, { status: 401 }) : response;

  if (needsMfa) {
    const url = request.nextUrl.clone();
    url.pathname = "/login/mfa";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(url);
    // Keep any session refresh that happened above.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  if (!signedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
