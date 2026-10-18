"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarToggleIcon, BackIcon, SettingsIcon } from "@/components/dashboard/icons";
import { ConnectWorkspace } from "@/components/connect";
import { useGmailThreads } from "@/hooks/use-gmail";
import { authClient } from "@/lib/auth-client";
import { ProfileCard, SecurityCard, DangerZoneCard } from "@/components/account";
import { log } from "@/lib/logger";

interface AccountInfo {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  hasPassword: boolean;
  providers: string[];
}

export default function AccountPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<"profile" | "connected-apps" | "security" | "your-data">("profile");

  const { data: session } = authClient.useSession();
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [dataDeletionSummary, setDataDeletionSummary] = useState<{
    deletedCounts: Record<string, number>;
    revocations: Record<string, { revoked: boolean; error?: string }>;
  } | null>(null);

  const { threads } = useGmailThreads();
  const unreadCount = Array.isArray(threads)
    ? threads.filter((t) => t.unread || t.data?.unread).length
    : 0;

  // Fetch account security/provider details
  const fetchAccountInfo = () => {
    fetch("/api/account/info")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setAccountInfo(data);
      })
      .catch((err) => {
        log.error("Failed to load account info", { error: err });
      });
  };

  useEffect(() => {
    let isCancelled = false;
    fetch("/api/account/info")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isCancelled && data) {
          setAccountInfo(data);
        }
      })
      .catch((err) => {
        log.error("Failed to load account info", { error: err });
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Scroll spy for left anchor nav
  useEffect(() => {
    const handleScroll = () => {
      const sections = ["profile", "connected-apps", "security", "your-data"] as const;
      const scrollPosition = window.scrollY + 120;

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveAnchor(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: "profile" | "connected-apps" | "security" | "your-data") => {
    setActiveAnchor(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const currentUser = {
    id: accountInfo?.user?.id || session?.user?.id || "",
    name: accountInfo?.user?.name || session?.user?.name || "",
    email: accountInfo?.user?.email || session?.user?.email || "",
    image: accountInfo?.user?.image || session?.user?.image || null,
  };

  const navItems = [
    {
      id: "profile" as const,
      label: "Profile",
      desc: "Name, email & avatar",
      icon: (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: "connected-apps" as const,
      label: "Connected Apps",
      desc: "Gmail & Calendar sync",
      icon: (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
      ),
    },
    {
      id: "security" as const,
      label: "Security",
      desc: "Password & sessions",
      icon: (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
    {
      id: "your-data" as const,
      label: "Your Data",
      desc: "Export & danger zone",
      icon: (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
    },
  ];

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
        activeNav="account"
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onSelectNav={(nav) => {
          if (nav === "inbox") {
            router.push("/dashboard/inbox");
          } else if (nav === "today" || nav === "upcoming") {
            router.push("/dashboard/calendar");
          } else if (nav === "account") {
            // Already here
          } else {
            router.push("/dashboard");
          }
        }}
        onOpenCalendar={() => router.push("/dashboard/calendar")}
        onGoBack={() => router.push("/dashboard")}
        inboxBadge={unreadCount}
      />

      {/* ── Main Area ── */}
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
        {/* Top Header Bar */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 28px",
            borderBottom: "1px solid var(--border-hairline)",
            background: "var(--bg-workspace)",
            flexShrink: 0,
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              title={sidebarCollapsed ? "Open primary sidebar" : "Collapse primary sidebar"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "1px solid var(--border-hairline)",
                borderRadius: 6,
                padding: "4px 6px",
                cursor: "pointer",
                color: "var(--text-secondary)",
                transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <SidebarToggleIcon size={14} />
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "transparent",
                border: "none",
                padding: "4px 6px",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontSize: 12.5,
                fontWeight: 500,
                borderRadius: 6,
                transition: "color 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <BackIcon size={12} />
              <span>Dashboard</span>
            </button>

            <span style={{ color: "var(--border-strong)", fontSize: 13 }}>/</span>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--accent-text)", display: "flex" }}>
                <SettingsIcon size={14} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                Account & Settings
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                background: "var(--hover-subtle)",
                border: "1px solid var(--border-hairline)",
                padding: "3px 10px",
                borderRadius: 20,
                fontWeight: 500,
              }}
            >
              {currentUser.email || "Active User"}
            </span>
          </div>
        </header>

        {/* ── Content with Left Section Nav & Cards ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Left Anchor Navigation Column */}
          <nav
            style={{
              width: 220,
              flexShrink: 0,
              borderRight: "1px solid var(--border-hairline)",
              background: "var(--bg-sidebar)",
              padding: "24px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "0 10px 10px",
              }}
            >
              Navigation
            </div>

            {navItems.map((item) => {
              const isActive = activeAnchor === item.id;
              const isDanger = item.id === "your-data";

              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: isActive
                      ? isDanger
                        ? "var(--danger-tint)"
                        : "var(--surface-card)"
                      : "transparent",
                    color: isActive
                      ? isDanger
                        ? "var(--danger)"
                        : "var(--text-primary)"
                      : isDanger
                      ? "var(--danger-hover)"
                      : "var(--text-secondary)",
                    fontWeight: isActive ? 600 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: isActive ? "0 1px 3px var(--shadow-color)" : "none",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = isDanger ? "var(--danger-tint)" : "var(--hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <span style={{ display: "flex", opacity: isActive ? 1 : 0.7 }}>
                    {item.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>{item.label}</div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Right Scrollable Cards Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "32px 40px 60px",
              background: "var(--bg-page)",
            }}
          >
            <div
              style={{
                maxWidth: 880,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: 28,
              }}
            >
              {/* Deletion Summary Banner */}
              {dataDeletionSummary && (
                <div
                  style={{
                    background: "var(--success-tint)",
                    border: "1px solid var(--success-border)",
                    borderRadius: 12,
                    padding: "16px 20px",
                    color: "var(--success)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>All synced user data was successfully removed</span>
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>
                    Cleaned up {dataDeletionSummary.deletedCounts.corsairEntities || 0} cached entities,{" "}
                    {dataDeletionSummary.deletedCounts.corsairEvents || 0} events,{" "}
                    {dataDeletionSummary.deletedCounts.conversations || 0} conversations, and{" "}
                    {dataDeletionSummary.deletedCounts.chatMessages || 0} chat messages.
                    {dataDeletionSummary.revocations && (
                      <div style={{ marginTop: 4 }}>
                        OAuth Revocations:{" "}
                        {Object.entries(dataDeletionSummary.revocations)
                          .map(([k, v]) => `${k}: ${v.revoked ? "Revoked" : v.error || "Failed"}`)
                          .join(" | ")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 1. Profile Section */}
              <ProfileCard
                user={currentUser}
                onUserUpdated={(up) => {
                  setAccountInfo((prev) =>
                    prev
                      ? {
                          ...prev,
                          user: {
                            ...prev.user,
                            ...(up.name ? { name: up.name } : {}),
                            ...(up.email ? { email: up.email } : {}),
                          },
                        }
                      : null
                  );
                }}
              />

              {/* 2. Connected Apps Section */}
              <div
                id="connected-apps"
                style={{
                  background: "var(--surface-card)",
                  borderRadius: 14,
                  border: "1px solid var(--border-hairline)",
                  padding: "24px 28px",
                  boxShadow: "0 1px 3px var(--shadow-color)",
                  scrollMarginTop: 80,
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Connected Apps & Integrations
                  </h2>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 13,
                      color: "var(--text-secondary)",
                    }}
                  >
                    Review connected mailboxes and calendars with live status monitoring and disconnect controls.
                  </p>
                </div>

                <Suspense fallback={<div style={{ padding: 20 }}>Loading connected apps...</div>}>
                  <ConnectWorkspace />
                </Suspense>
              </div>

              {/* 3. Security Section */}
              <SecurityCard
                hasPassword={Boolean(accountInfo?.hasPassword)}
                providers={accountInfo?.providers || []}
              />

              {/* 4. Danger Zone Section */}
              <DangerZoneCard
                hasPassword={Boolean(accountInfo?.hasPassword)}
                onDataDeleted={(summary) => {
                  setDataDeletionSummary(summary);
                  fetchAccountInfo();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
