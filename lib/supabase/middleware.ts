import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/config";

const PUBLIC_PATHS = ["/login"];

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // Fixture gallery for development; the page itself answers 404 in production.
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/dev/")) return true;
  // PWA assets must be reachable without a session.
  if (pathname === "/manifest.webmanifest" || pathname === "/sw.js" || pathname.startsWith("/icons/") || pathname === "/icon.svg" || pathname === "/apple-icon.png") return true;
  return false;
}

/** Refreshes the Supabase session cookie and redirects anonymous visitors to /login. */
export async function updateSession(request: NextRequest) {
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
