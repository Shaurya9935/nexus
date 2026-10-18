"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { RightPanel } from "@/components/dashboard/right-panel";
import { CalendarIcon, SearchIcon, SidebarToggleIcon } from "@/components/dashboard/icons";
import {
  CalendarWorkspace,
  CalendarSyncingView,
  CalendarEmptyView,
  CalendarConnectView,
} from "@/components/calendar";
import { useGmailThreads } from "@/hooks/use-gmail";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { useIntegrations } from "@/hooks/use-integrations";
import { GoogleCalendarBrandIcon } from "@/components/connect/brand-icons";
import { useCurrentTime } from "@/hooks/use-current-time";

export default function CalendarPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { threads } = useGmailThreads();
  const {
    isCalendarConnected,
    isConnectingCalendar,
    connectCalendar,
    isLoading: integrationsLoading,
  } = useIntegrations();
  const {
    events,
    todayEvents,
    isLoading: isEventsLoading,
    isSyncing,
    sync,
    lastSyncedAt,
    isNotConnected: calendarNotConnected,
  } = useCalendarEvents();
  const currentMs = useCurrentTime();

  const isNotConnected = calendarNotConnected || (!integrationsLoading && !isCalendarConnected);
  const isLoading = isEventsLoading || integrationsLoading;

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
        activeWorkspace="calendar"
        activeNav="today"
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onSelectNav={(nav) => {
          if (nav === "inbox") {
            router.push("/dashboard/inbox");
          } else if (nav === "today" || nav === "upcoming") {
            // Already on calendar page
          } else {
            router.push("/dashboard");
          }
        }}
        onOpenCalendar={() => {}}
        onGoBack={() => router.push("/dashboard")}
        inboxBadge={unreadCount}
      />

      {/* ── Main Calendar Content Area ── */}
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
            background: "var(--bg-workspace)",
            flexShrink: 0,
            gap: 16,
          }}
        >
          {/* Service Title */}
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
            <div style={{ width: 1, height: 16, background: "var(--border-hairline)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--accent-text)", display: "flex" }}>
                <CalendarIcon size={16} />
              </span>
              <h1
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                Calendar
              </h1>
              {isNotConnected ? (
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    color: "var(--warning)",
                    background: "var(--warning-tint)",
                    padding: "2px 7px",
                    borderRadius: 12,
                    fontWeight: 500,
                  }}
                >
                  Not connected
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    color: "var(--accent-text)",
                    background: "var(--accent-tint)",
                    padding: "2px 7px",
                    borderRadius: 12,
                    fontWeight: 500,
                  }}
                >
                  Google Calendar
                </span>
              )}
            </div>
          </div>

          {/* Search & Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--hover-subtle)",
                border: "1px solid var(--border-hairline)",
                borderRadius: 8,
                padding: "6px 12px",
                width: 240,
              }}
            >
              <span style={{ color: "var(--text-muted)", display: "flex" }}>
                <SearchIcon size={13} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isNotConnected ? "Connect Calendar to search events…" : "Search events…"}
                disabled={isNotConnected}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: 13,
                  fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                  color: "var(--text-primary)",
                  width: "100%",
                }}
              />
            </div>

            {/* Last synced label */}
            {lastSyncedAt && !isSyncing && !isNotConnected && (
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
                  whiteSpace: "nowrap",
                }}
              >
                Synced{" "}
                {(() => {
                  if (!currentMs) return "recently";
                  const diffMs = currentMs - lastSyncedAt.getTime();
                  const diffMin = Math.floor(diffMs / 60000);
                  if (diffMin < 1) return "just now";
                  if (diffMin === 1) return "1 min ago";
                  return `${diffMin} min ago`;
                })()}
              </span>
            )}

            {/* Sync / Refresh or Connect button */}
            {isNotConnected ? (
              <button
                onClick={() => connectCalendar()}
                disabled={isConnectingCalendar}
                title="Connect your Google Calendar account"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  background: isConnectingCalendar ? "var(--accent-hover)" : "var(--accent-solid)",
                  color: "var(--on-accent)",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: isConnectingCalendar ? "default" : "pointer",
                  opacity: isConnectingCalendar ? 0.85 : 1,
                  fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
                  transition: "background 0.15s, opacity 0.15s",
                }}
              >
                <GoogleCalendarBrandIcon size={14} />
                <span>{isConnectingCalendar ? "Connecting…" : "Connect Calendar"}</span>
              </button>
            ) : (
              <button
                onClick={() => sync()}
                disabled={isSyncing}
                title="Fetch latest events from Google Calendar"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  background: isSyncing ? "var(--accent-hover)" : "var(--accent-solid)",
                  color: "var(--on-accent)",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: isSyncing ? "default" : "pointer",
                  opacity: isSyncing ? 0.85 : 1,
                  fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
                  transition: "background 0.15s, opacity 0.15s",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{
                    animation: isSyncing ? "spin 0.8s linear infinite" : "none",
                    opacity: isSyncing ? 1 : 0.75,
                  }}
                >
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity={0.35} strokeWidth="1.8" />
                  <path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span>{isSyncing ? "Syncing…" : "Refresh"}</span>
              </button>
            )}
          </div>
        </header>

        {/* ── Calendar Workspace / Syncing View / Empty View / Connect View ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {isNotConnected && !isLoading ? (
            <CalendarConnectView onConnect={connectCalendar} isConnecting={isConnectingCalendar} />
          ) : (isLoading || isSyncing) && events.length === 0 ? (
            <CalendarSyncingView />
          ) : events.length === 0 ? (
            <CalendarEmptyView onSync={() => sync()} isSyncing={isSyncing} />
          ) : (
            <>
              {isSyncing && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "6px 14px",
                    background: "var(--accent-tint)",
                    borderBottom: "1px solid var(--accent-border)",
                    fontSize: 12,
                    color: "var(--accent-text)",
                    fontWeight: 500,
                    fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  >
                    <circle cx="8" cy="8" r="6" stroke="var(--accent-border)" strokeWidth="2.5" />
                    <path d="M8 2a6 6 0 016 6" stroke="var(--accent-text)" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  <span>Syncing latest updates from Google Calendar…</span>
                </div>
              )}
              <CalendarWorkspace initialEvents={events} />
            </>
          )}
        </div>
      </div>

      {/* ── Right Context Panel ── */}
      <RightPanel
        events={todayEvents}
        onOpenCalendar={() => {}}
        isCalendarConnected={!isNotConnected}
        onConnectCalendar={connectCalendar}
      />
    </div>
  );
}
