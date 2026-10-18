import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

function getBaseUrl(request: NextRequest): string {
  if (env.APP_URL && !env.APP_URL.includes("localhost")) {
    return env.APP_URL;
  }
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return request.nextUrl.origin || env.APP_URL || "http://localhost:3000";
}

// Optimistic auth check per https://docs.corsair.dev + Next proxy docs
// Does not verify JWT in proxy (DB check is in server actions); only checks cookie presence to avoid flash of unauth content.
const PROTECTED_PREFIXES = ["/dashboard", "/connect"];
const PROTECTED_API_PREFIXES = [
  "/api/gmail",
  "/api/integrations",
  "/api/calendar",
  "/api/conversations",
  "/api/ai",
  "/api/account",
  "/api/onboarding",
  "/api/mcp",
  "/api/admin",
];
const AUTH_ROUTES = ["/login", "/register"];
const PUBLIC_EXACT = ["/", "/api/auth", "/api/corsair", "/api/webhooks", "/api/waitlist"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isProtectedApi(pathname: string) {
  return PROTECTED_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isPublic(pathname: string) {
  if (PUBLIC_EXACT.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // better-auth sets cookies like better-auth.session_token or __Secure-better-auth.session_token
  const hasSession = request.cookies.getAll().some(
    (c) =>
      c.name.includes("session_token") ||
      c.name.includes("session-token") ||
      (c.name.includes("session") && !c.name.includes("csrf"))
  );

  const hasBearer = Boolean(request.headers.get("authorization")?.startsWith("Bearer "));

  if (isProtectedApi(pathname) && !hasSession && !hasBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isProtected(pathname) && !hasSession) {
    const url = new URL("/login", getBaseUrl(request));
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", getBaseUrl(request)));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/connect/:path*",
    "/login",
    "/register",
    "/api/gmail/:path*",
    "/api/integrations/:path*",
    "/api/calendar/:path*",
    "/api/conversations/:path*",
    "/api/ai/:path*",
    "/api/account/:path*",
    "/api/onboarding/:path*",
    "/api/mcp/:path*",
    "/api/admin/:path*",
  ],
};
