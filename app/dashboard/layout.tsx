import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TourProvider } from "@/components/onboarding";
import { BetaBanner } from "@/components/dashboard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <TourProvider>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          width: "100%",
          overflow: "hidden",
        }}
      >
        <BetaBanner />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
    </TourProvider>
  );
}
