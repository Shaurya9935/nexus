import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/env";

export async function GET() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  const isAdmin = Boolean(session?.user?.email && isAdminEmail(session.user.email));

  return NextResponse.json({ isAdmin });
}
