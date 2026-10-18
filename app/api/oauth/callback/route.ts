import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { corsair } from "@/lib/corsair";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";


function getAppBaseUrl(request: NextRequest): string {
  if (env.APP_URL && !env.APP_URL.includes("localhost")) {
    return env.APP_URL;
  }
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return env.APP_URL || request.nextUrl.origin || "http://localhost:3000";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const baseUrl = getAppBaseUrl(request);

  if (error) {
    log.warn("[oauth/callback] Provider authorization error", { error });
    const statusFlag =
      error === "access_denied" || error.toLowerCase().includes("denied")
        ? "access_denied"
        : "failed";
    const redirectUrl = new URL(`/dashboard/connect?error=${statusFlag}`, baseUrl);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !state) {
    log.warn("[oauth/callback] Missing code or state parameters");
    const redirectUrl = new URL("/dashboard/connect?error=invalid_request", baseUrl);
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const result = await corsair.manage.connect.oauthCallback({ code, state });
    const targetUrl = new URL(
      `/dashboard?connected=${encodeURIComponent(result.plugin)}`,
      baseUrl
    );
    return NextResponse.redirect(targetUrl);
  } catch (err) {
    log.error("[oauth/callback] OAuth callback execution failed", { error: err });
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    const isDenied =
      msg.includes("access_denied") ||
      msg.includes("permission_denied") ||
      msg.includes("403") ||
      msg.includes("unauthorized") ||
      msg.includes("not a test user");
    const statusFlag = isDenied ? "access_denied" : "failed";
    const redirectUrl = new URL(`/dashboard/connect?error=${statusFlag}`, baseUrl);
    return NextResponse.redirect(redirectUrl);
  }
}

