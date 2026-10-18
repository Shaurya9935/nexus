import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { corsair } from "@/lib/corsair";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

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

  if (error) {
    return new NextResponse(
      `<html><body><h2>Authorization failed</h2><p>${escapeHtml(error)}</p><a href="/connect">Back</a></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code || !state) {
    return new NextResponse("<p>Missing code or state.</p><a href='/connect'>Back</a>", {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const result = await corsair.manage.connect.oauthCallback({ code, state });
    const targetUrl = new URL(
      `/dashboard?connected=${encodeURIComponent(result.plugin)}`,
      getAppBaseUrl(request)
    );
    return NextResponse.redirect(targetUrl);
  } catch (err) {
    log.error("[oauth/callback] OAuth error", { error: err });
    return new NextResponse(
      `<html><body><h2>Authorization error</h2><p>Something went wrong during authorization. Please try again.</p><a href="/connect">Back</a></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
