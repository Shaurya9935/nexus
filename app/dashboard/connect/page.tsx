"use client";

import React, { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { BackIcon } from "@/components/dashboard/icons";
import { ConnectWorkspace } from "@/components/connect";
import { useGmailThreads } from "@/hooks/use-gmail";

function ConnectPageContent() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { threads } = useGmailThreads();
  const unreadCount = Array.isArray(threads)
    ? threads.filter((t) => t.unread || t.data?.unread).length
    : 0;

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        background: "var(--bg-page)",
        fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
        overflow: "hidden",
      }}
    >
      {/* ── Sidebar ── */}
      <Sidebar
        activeNav="connect"
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onSelectNav={(nav) => {
          if (nav === "inbox") {
            router.push("/dashboard/inbox");
          } else if (nav === "today" || nav === "upcoming") {
            router.push("/dashboard/calendar");
          } else {
            router.push("/dashboard");
          }
        }}
        onOpenCalendar={() => router.push("/dashboard/calendar")}
        onGoBack={() => router.push("/dashboard")}
        inboxBadge={unreadCount}
      />

      {/* ── Main Connect Area ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
          background: "var(--bg-workspace)",
        }}
      >
        {/* ── Top Header Bar ── */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 28px",
            borderBottom: "1px solid var(--border-hairline)",
            background: "var(--surface-card)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              aria-label="Back to dashboard"
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                border: "1px solid var(--border-hairline)",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <BackIcon size={14} />
            </button>
            <div>
              <h1
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  margin: 0,
                  letterSpacing: "-0.015em",
                }}
              >
                Connected Apps & Integrations
              </h1>
              <p
                style={{
                  fontSize: 11.5,
                  color: "var(--text-muted)",
                  margin: "1px 0 0",
                }}
              >
                Manage third-party tools, OAuth authorizations, and data access
              </p>
            </div>
          </div>
        </header>

        {/* ── Scrollable workspace ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
          }}
        >
          <ConnectWorkspace />
        </div>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectPageContent />
    </Suspense>
  );
}
