"use client";

import React, { useRef, useEffect } from "react";
import { BellIcon } from "./icons";
import { Dot } from "./dot";
import { Avatar } from "./avatar";
import { authClient } from "@/lib/auth-client";
import { View, Email, ServiceConnection, UserProfile } from "./types";
import { SERVICE_CONNECTIONS, CURRENT_USER } from "./mock-data";

import { ThemeToggleButton } from "@/components/theme";

export interface TopBarProps {
  view: View;
  selectedEmail: Email | null;
  statusOpen: boolean;
  onToggleStatus: () => void;
  onCloseStatus: () => void;
  connections?: ServiceConnection[];
  user?: UserProfile;
}

export function TopBar({
  view,
  selectedEmail,
  statusOpen,
  onToggleStatus,
  onCloseStatus,
  connections = SERVICE_CONNECTIONS,
  user = CURRENT_USER,
}: TopBarProps) {
  const { data: session } = authClient.useSession();
  const displayUser = session?.user
    ? {
        name: session.user.name || session.user.email.split("@")[0],
        email: session.user.email,
        initials: (session.user.name || session.user.email)
          .split(" ")
          .map((w: string) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        color: "var(--accent-text)",
      }
    : {
        ...user,
        color: "var(--accent-text)",
      };
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(event.target as Node)
      ) {
        onCloseStatus();
      }
    }

    if (statusOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [statusOpen, onCloseStatus]);

  const breadcrumbText = () => {
    if (view === "email" && selectedEmail) {
      return `${selectedEmail.from} · ${selectedEmail.subject}`;
    }
    if (view === "calendar") {
      return "Today's schedule";
    }
    return "Nexus";
  };

  const essentialConnections = connections.filter((c) => c.label !== "Nexus AI");
  const allConnected = essentialConnections.length > 0 && essentialConnections.every((c) => c.ok);
  const anyConnected = essentialConnections.some((c) => c.ok);
  const statusColor = allConnected
    ? "var(--status-connected)"
    : anyConnected
    ? "var(--status-partial)"
    : "var(--text-muted)";
  const statusLabel = allConnected ? "Connected" : anyConnected ? "Partial" : "Not connected";

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 28px",
        borderBottom: "1px solid var(--border-hairline)",
        background: "var(--surface-card)",
        flexShrink: 0,
        gap: 10,
      }}
    >
      {/* Breadcrumb */}
      <div
        style={{
          flex: 1,
          fontSize: 12.5,
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: view !== "default" ? "var(--text-secondary)" : "var(--text-muted)" }}>
          {breadcrumbText()}
        </span>
      </div>

      {/* Connection Status Popover */}
      <div style={{ position: "relative" }} ref={statusMenuRef}>
        <button
          data-tour="connect-apps"
          onClick={onToggleStatus}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11.5,
            color: statusColor,
            background: statusOpen ? "var(--hover)" : "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            padding: "4px 8px",
            borderRadius: 6,
            transition: "background 0.12s",
          }}
          onMouseEnter={(e) => {
            if (!statusOpen) e.currentTarget.style.background = "var(--hover)";
          }}
          onMouseLeave={(e) => {
            if (!statusOpen) e.currentTarget.style.background = "transparent";
          }}
        >
          <Dot color={statusColor} size={5.5} /> {statusLabel}
        </button>

        {statusOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 6px)",
              background: "var(--surface-card)",
              border: "1px solid var(--border-hairline)",
              borderRadius: 10,
              padding: "12px 16px",
              boxShadow: "0 4px 16px var(--shadow-color)",
              minWidth: 160,
              zIndex: 30,
            }}
          >
            {connections.map(({ label, ok }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  fontSize: 12.5,
                  fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
                  color: "var(--text-primary)",
                  padding: "4px 0",
                }}
              >
                <span>{label}</span>
                <span
                  style={{
                    fontSize: 11.5,
                    color: ok ? "var(--status-connected)" : "var(--danger)",
                  }}
                >
                  {ok ? "✓" : "✗"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Theme Toggle Button (Light/Dark mode) */}
      <ThemeToggleButton />

      {/* Notifications */}
      <button
        type="button"
        aria-label="Notifications"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: "1px solid var(--border-hairline)",
          background: "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          position: "relative",
          transition: "background 0.12s, color 0.12s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <BellIcon />
        <div
          style={{
            position: "absolute",
            top: 7,
            right: 7,
            width: 4.5,
            height: 4.5,
            borderRadius: "50%",
            background: "var(--accent-text)",
            border: "1.5px solid var(--surface-card)",
          }}
        />
      </button>

      {/* Header Avatar */}
      <Avatar initials={displayUser.initials} color={displayUser.color} size={32} />
    </header>
  );
}
