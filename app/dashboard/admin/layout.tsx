import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/env";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    notFound();
  }

  return <>{children}</>;
}
