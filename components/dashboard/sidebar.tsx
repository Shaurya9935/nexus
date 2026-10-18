"use client";

import React, { useState, useEffect, useRef } from "react";
import { log } from "@/lib/logger";
import { useTour } from "@/components/onboarding";
import {
  LogoIcon,
  InboxIcon,
  ChatIcon,
  StarIcon,
  DraftIcon,
  SendIcon,
  CalendarIcon,
  UpcomingIcon,
  SearchIcon,
  CommandIcon,
  SettingsIcon,
  HelpIcon,
  SidebarToggleIcon,
  LogoutIcon,
  GmailIcon,
  OutlookIcon,
  ChevronRightIcon,
  LabelIcon,
  TrashIcon,
  AllMailIcon,
  SpamIcon,
  UsersIcon,
} from "./icons";
import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "./avatar";
import { UserProfile } from "./types";
import { CURRENT_USER } from "./mock-data";

export type WorkspaceId = "gmail" | "calendar" | "outlook" | "chat";

export interface SidebarProps {
  activeNav: string;
  onSelectNav: (nav: string) => void;
  onOpenCalendar: () => void;
  onGoBack: () => void;
  user?: UserProfile;
  inboxBadge?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  activeWorkspace?: WorkspaceId | null;
  onSelectWorkspace?: (id: WorkspaceId | null) => void;
  secondaryOpen?: boolean;
  onToggleSecondary?: () => void;
}

// ─── Primitive helpers ────────────────────────────────────────────────────────

type IconComponent = ({ className, size }: { className?: string; size?: number }) => React.JSX.Element;

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div
      style={{
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: "0.1em",
        color: "var(--text-disabled)",
        textTransform: "uppercase",
        padding: "0 10px",
        marginBottom: 3,
      }}
    >
      {label}
    </div>
  );
}

function NavBtn({
  icon: Icon,
  label,
  active = false,
  badge,
  collapsed = false,
  muted = false,
  onClick,
  dataTour,
}: {
  icon: IconComponent;
  label: string;
  active?: boolean;
  badge?: number;
  collapsed?: boolean;
  muted?: boolean;
  onClick: () => void;
  dataTour?: string;
}) {
  const [hov, setHov] = useState(false);

  return (
    <button
      data-tour={dataTour}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={collapsed ? label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: collapsed ? 0 : 8,
        padding: collapsed ? "8px 0" : "6px 10px",
        borderRadius: 7,
        width: "100%",
        border: "none",
        cursor: "pointer",
        fontSize: muted ? 12.5 : 13,
        fontWeight: active ? 500 : 400,
        fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
        color: active ? "var(--accent-text)" : hov ? "var(--text-primary)" : muted ? "var(--text-muted)" : "var(--text-secondary)",
        background: active ? "var(--accent-tint)" : hov ? "var(--hover)" : "transparent",
        transition: "background 0.12s, color 0.12s",
        textAlign: "left",
        position: "relative",
      }}
    >
      <span
        style={{
          opacity: active ? 1 : muted ? 0.45 : 0.6,
          transition: "opacity 0.12s",
          display: "flex",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <Icon />
        {/* Collapsed unread dot */}
        {collapsed && badge != null && badge > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -3,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--accent-solid)",
              border: "1.5px solid var(--bg-sidebar)",
            }}
          />
        )}
      </span>

      {!collapsed && <span style={{ flex: 1, whiteSpace: "nowrap" }}>{label}</span>}

      {!collapsed && badge != null && badge > 0 && (
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            color: active ? "var(--accent-text)" : "var(--text-muted)",
            background: active ? "var(--accent-border)" : "var(--border-hairline)",
            padding: "1px 6px",
            borderRadius: 20,
            lineHeight: "16px",
            flexShrink: 0,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function PrimaryActionBtn({
  icon: Icon,
  label,
  collapsed = false,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  collapsed?: boolean;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={collapsed ? label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: collapsed ? 0 : 8,
        padding: collapsed ? "10px 0" : "8px 14px",
        borderRadius: 8,
        width: "100%",
        border: "none",
        cursor: "pointer",
        fontSize: 13.5,
        fontWeight: 500,
        fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
        color: "var(--on-accent)",
        background: hov ? "var(--accent-hover)" : "var(--accent-solid)",
        transition: "background 0.15s, transform 0.1s",
        transform: hov ? "scale(1.02)" : "scale(1)",
        boxShadow: "0 2px 4px var(--shadow-color)",
      }}
    >
      <span style={{ display: "flex", flexShrink: 0 }}>
        <Icon size={16} />
      </span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

/** Workspace row with a right-side chevron — used in main nav mode */
function WorkspaceRow({
  icon: Icon,
  label,
  active = false,
  onClick,
  collapsed = false,
  dataTour,
}: {
  icon: IconComponent;
  label: string;
  active?: boolean;
  onClick: () => void;
  collapsed?: boolean;
  dataTour?: string;
}) {
  const [hov, setHov] = useState(false);

  return (
    <button
      data-tour={dataTour}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={collapsed ? label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: collapsed ? 0 : 8,
        padding: collapsed ? "8px 0" : "7px 10px",
        borderRadius: 7,
        width: "100%",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
        background: active ? "var(--accent-tint)" : hov ? "var(--hover)" : "transparent",
        transition: "background 0.12s",
        textAlign: "left",
      }}
    >
      {/* Icon */}
      <span
        style={{
          display: "flex",
          flexShrink: 0,
          color: active ? "var(--accent-text)" : hov ? "var(--text-primary)" : "var(--text-secondary)",
          opacity: active ? 1 : 0.7,
          transition: "color 0.12s, opacity 0.12s",
        }}
      >
        <Icon size={14} />
      </span>

      {!collapsed && (
        <>
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: active ? 500 : 400,
              color: active ? "var(--accent-text)" : hov ? "var(--text-primary)" : "var(--text-secondary)",
              transition: "color 0.12s",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
          <span
            style={{
              color: hov ? "var(--text-muted)" : "var(--text-disabled)",
              display: "flex",
              transition: "color 0.12s, transform 0.15s",
              transform: hov ? "translateX(1px)" : "none",
              flexShrink: 0,
            }}
          >
            <ChevronRightIcon size={11} />
          </span>
        </>
      )}
    </button>
  );
}

/** Thin divider between sections */
function Divider() {
  return <div style={{ height: 1, background: "var(--border-hairline)", margin: "8px 10px" }} />;
}

// ─── Footer (shared) ──────────────────────────────────────────────────────────

function SidebarFooter({
  collapsed,
  handleToggle,
  displayUser,
  handleLogout,
  onOpenAccount,
  isAccountActive,
}: {
  collapsed: boolean;
  handleToggle: () => void;
  displayUser: { name: string; email: string; initials: string; color: string };
  handleLogout: () => void;
  onOpenAccount?: () => void;
  isAccountActive?: boolean;
}) {
  const { startTour } = useTour();
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    }
    if (helpOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [helpOpen]);

  return (
    <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: 8 }}>
      {/* Collapse/Expand toggle */}
      <NavBtn
        icon={SidebarToggleIcon}
        label={collapsed ? "Expand" : "Collapse"}
        active={false}
        collapsed={collapsed}
        onClick={handleToggle}
      />
      <NavBtn
        dataTour="account"
        icon={SettingsIcon}
        label="Settings"
        active={Boolean(isAccountActive)}
        collapsed={collapsed}
        onClick={onOpenAccount || (() => {})}
      />
      
      {/* Help with Replay Tour Popover */}
      <div style={{ position: "relative" }} ref={helpRef}>
        <NavBtn
          icon={HelpIcon}
          label="Help"
          collapsed={collapsed}
          onClick={() => setHelpOpen((prev) => !prev)}
        />
        {helpOpen && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              marginBottom: 6,
              background: "var(--surface-card)",
              border: "1px solid var(--border-hairline)",
              borderRadius: 10,
              padding: "6px",
              boxShadow: "0 10px 28px var(--shadow-color)",
              zIndex: 100,
              minWidth: 175,
            }}
          >
            <button
              onClick={() => {
                setHelpOpen(false);
                startTour();
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "none",
                background: "transparent",
                color: "var(--text-primary)",
                fontSize: 12.5,
                fontWeight: 500,
                textAlign: "left",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 14 }}>🧭</span>
              <span>Replay product tour</span>
            </button>
          </div>
        )}
      </div>

      {/* User row */}
      <div
        data-tour="account"
        onClick={onOpenAccount}
        title={collapsed ? `${displayUser.name} (${displayUser.email})` : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 9,
          padding: collapsed ? "8px 0" : "8px 8px",
          marginTop: 4,
          borderRadius: 8,
          cursor: "pointer",
          background: isAccountActive ? "var(--hover-subtle)" : "transparent",
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => {
          if (!isAccountActive) e.currentTarget.style.background = "var(--hover)";
        }}
        onMouseLeave={(e) => {
          if (!isAccountActive) e.currentTarget.style.background = "transparent";
        }}
      >
        <Avatar initials={displayUser.initials} color={displayUser.color} size={26} />
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayUser.name}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayUser.email}
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        title={collapsed ? "Log out" : undefined}
        style={{
          width: "100%",
          marginTop: 8,
          padding: collapsed ? "6px 0" : "6px 10px",
          borderRadius: 7,
          border: "1px solid var(--border-hairline)",
          background: "var(--surface-card)",
          fontSize: 12.5,
          fontWeight: 500,
          color: "var(--text-secondary)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: collapsed ? 0 : 7,
          fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
          transition: "background 0.12s, color 0.12s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--danger-tint)";
          e.currentTarget.style.color = "var(--danger)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--surface-card)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
      >
        <LogoutIcon size={14} />
        {!collapsed && <span>Log out</span>}
      </button>
    </div>
  );
}

// ─── Secondary Sidebar Header ───────────────────────────────────────────────────

function SecondaryHeader({
  icon: Icon,
  title,
  subtitle,
  onClose,
}: {
  icon: IconComponent;
  title: string;
  subtitle?: string;
  onClose?: () => void;
}) {
  const [hov, setHov] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 8px 12px",
        borderBottom: "1px solid var(--border-hairline)",
        marginBottom: 12,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "var(--accent-tint)",
            color: "var(--accent-text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={14} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--text-primary)",
              letterSpacing: "-0.015em",
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 10.5,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 120,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          title="Hide panel"
          style={{
            background: hov ? "var(--hover)" : "transparent",
            border: "none",
            borderRadius: 5,
            padding: "4px 5px",
            cursor: "pointer",
            color: hov ? "var(--text-primary)" : "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.12s, color 0.12s",
          }}
        >
          <SidebarToggleIcon size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Context panels (Secondary sidebar content) ─────────────────────────────────

function GmailSecondaryPanel({
  activeNav,
  inboxBadge,
  otherWorkspaces,
  onSelectNav,
  onSwitchWorkspace,
  onClose,
}: {
  activeNav: string;
  inboxBadge: number;
  otherWorkspaces: { id: WorkspaceId; icon: IconComponent; label: string }[];
  onSelectNav: (nav: string) => void;
  onSwitchWorkspace: (id: WorkspaceId) => void;
  onClose?: () => void;
}) {
  return (
    <>
      <SecondaryHeader icon={GmailIcon} title="Gmail" subtitle="Inbox & Mail" onClose={onClose} />

      {/* Mail section */}
      <div style={{ marginBottom: 18 }}>
        <SectionLabel label="Mail" collapsed={false} />
        <NavBtn
          icon={InboxIcon}
          label="Inbox"
          active={activeNav === "inbox"}
          badge={inboxBadge}
          onClick={() => onSelectNav("inbox")}
        />
        <NavBtn
          icon={StarIcon}
          label="Starred"
          active={activeNav === "starred"}
          onClick={() => onSelectNav("starred")}
        />
        <NavBtn
          icon={DraftIcon}
          label="Drafts"
          active={activeNav === "drafts"}
          onClick={() => onSelectNav("drafts")}
        />
        <NavBtn
          icon={SendIcon}
          label="Sent"
          active={activeNav === "sent"}
          onClick={() => onSelectNav("sent")}
        />
        <NavBtn
          icon={AllMailIcon}
          label="All Mail"
          active={activeNav === "all-mail"}
          onClick={() => onSelectNav("all-mail")}
        />
        <NavBtn
          icon={SpamIcon}
          label="Spam"
          active={activeNav === "spam"}
          onClick={() => onSelectNav("spam")}
          muted
        />
        <NavBtn
          icon={TrashIcon}
          label="Trash"
          active={activeNav === "trash"}
          onClick={() => onSelectNav("trash")}
          muted
        />
      </div>

      {/* Labels section */}
      <div style={{ marginBottom: 18 }}>
        <SectionLabel label="Labels" collapsed={false} />
        {["Work", "Personal", "Projects"].map((lbl) => (
          <NavBtn
            key={lbl}
            icon={LabelIcon}
            label={lbl}
            active={activeNav === `label-${lbl.toLowerCase()}`}
            onClick={() => onSelectNav(`label-${lbl.toLowerCase()}`)}
          />
        ))}
      </div>

      {/* Other workspaces */}
      {otherWorkspaces.length > 0 && (
        <>
          <Divider />
          <div style={{ marginBottom: 8 }}>
            <SectionLabel label="Other Workspaces" collapsed={false} />
            {otherWorkspaces.map((w) => (
              <NavBtn
                key={w.id}
                icon={w.icon}
                label={w.label}
                muted
                onClick={() => onSwitchWorkspace(w.id)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function CalendarSecondaryPanel({
  activeNav,
  otherWorkspaces,
  onSelectNav,
  onSwitchWorkspace,
  onClose,
  router,
}: {
  activeNav: string;
  otherWorkspaces: { id: WorkspaceId; icon: IconComponent; label: string }[];
  onSelectNav: (nav: string) => void;
  onSwitchWorkspace: (id: WorkspaceId) => void;
  onClose?: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      <SecondaryHeader icon={CalendarIcon} title="Calendar" subtitle="Events & Schedule" onClose={onClose} />

      <div style={{ marginBottom: 18 }}>
        <SectionLabel label="Schedule" collapsed={false} />
        <NavBtn
          icon={CalendarIcon}
          label="Today"
          active={activeNav === "today"}
          onClick={() => {
            onSelectNav("today");
            router.push("/dashboard/calendar");
          }}
        />
        <NavBtn
          icon={UpcomingIcon}
          label="Upcoming"
          active={activeNav === "upcoming"}
          onClick={() => {
            onSelectNav("upcoming");
            router.push("/dashboard/calendar");
          }}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <SectionLabel label="My Calendars" collapsed={false} />
        {["Personal", "Work"].map((cal) => (
          <NavBtn
            key={cal}
            icon={CalendarIcon}
            label={cal}
            active={activeNav === `cal-${cal.toLowerCase()}`}
            onClick={() => onSelectNav(`cal-${cal.toLowerCase()}`)}
          />
        ))}
      </div>

      {otherWorkspaces.length > 0 && (
        <>
          <Divider />
          <div style={{ marginBottom: 8 }}>
            <SectionLabel label="Other Workspaces" collapsed={false} />
            {otherWorkspaces.map((w) => (
              <NavBtn
                key={w.id}
                icon={w.icon}
                label={w.label}
                muted
                onClick={() => {
                  if (w.id === "gmail") {
                    router.push("/dashboard/inbox");
                  }
                  onSwitchWorkspace(w.id);
                }}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function OutlookSecondaryPanel({
  activeNav,
  otherWorkspaces,
  onSelectNav,
  onSwitchWorkspace,
  onClose,
}: {
  activeNav: string;
  otherWorkspaces: { id: WorkspaceId; icon: IconComponent; label: string }[];
  onSelectNav: (nav: string) => void;
  onSwitchWorkspace: (id: WorkspaceId) => void;
  onClose?: () => void;
}) {
  return (
    <>
      <SecondaryHeader icon={OutlookIcon} title="Outlook" subtitle="Microsoft 365" onClose={onClose} />

      <div style={{ marginBottom: 18 }}>
        <SectionLabel label="Mail" collapsed={false} />
        <NavBtn
          icon={InboxIcon}
          label="Inbox"
          active={activeNav === "outlook-inbox"}
          onClick={() => onSelectNav("outlook-inbox")}
        />
        <NavBtn
          icon={StarIcon}
          label="Starred"
          active={activeNav === "outlook-starred"}
          onClick={() => onSelectNav("outlook-starred")}
        />
        <NavBtn
          icon={DraftIcon}
          label="Drafts"
          active={activeNav === "outlook-drafts"}
          onClick={() => onSelectNav("outlook-drafts")}
        />
        <NavBtn
          icon={SendIcon}
          label="Sent"
          active={activeNav === "outlook-sent"}
          onClick={() => onSelectNav("outlook-sent")}
        />
        <NavBtn
          icon={AllMailIcon}
          label="Archive"
          active={activeNav === "outlook-archive"}
          onClick={() => onSelectNav("outlook-archive")}
          muted
        />
        <NavBtn
          icon={TrashIcon}
          label="Trash"
          active={activeNav === "outlook-trash"}
          onClick={() => onSelectNav("outlook-trash")}
          muted
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <SectionLabel label="Folders" collapsed={false} />
        {["Work", "Personal", "Projects"].map((folder) => (
          <NavBtn
            key={folder}
            icon={LabelIcon}
            label={folder}
            active={activeNav === `outlook-folder-${folder.toLowerCase()}`}
            onClick={() => onSelectNav(`outlook-folder-${folder.toLowerCase()}`)}
          />
        ))}
      </div>

      {otherWorkspaces.length > 0 && (
        <>
          <Divider />
          <div style={{ marginBottom: 8 }}>
            <SectionLabel label="Other Workspaces" collapsed={false} />
            {otherWorkspaces.map((w) => (
              <NavBtn
                key={w.id}
                icon={w.icon}
                label={w.label}
                muted
                onClick={() => onSwitchWorkspace(w.id)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

interface SidebarConversation {
  id: string;
  title: string | null;
  createdAt?: string | Date;
  updatedAt: string | Date;
}

function ChatSecondaryPanel({
  activeNav,
  otherWorkspaces,
  onSelectNav,
  onSwitchWorkspace,
  onClose,
  onNewChat,
}: {
  activeNav: string;
  otherWorkspaces: { id: WorkspaceId; icon: IconComponent; label: string }[];
  onSelectNav: (nav: string) => void;
  onSwitchWorkspace: (id: WorkspaceId) => void;
  onClose?: () => void;
  onNewChat: () => void;
}) {
  const [conversations, setConversations] = useState<SidebarConversation[]>([]);

  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await fetch("/api/conversations");
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      } catch (e) {
        log.error("Failed to load conversations", { error: e });
      }
    }
    loadConversations();
  }, []);

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  const grouped: {
    today: SidebarConversation[];
    yesterday: SidebarConversation[];
    previous7days: SidebarConversation[];
    older: SidebarConversation[];
  } = {
    today: [],
    yesterday: [],
    previous7days: [],
    older: [],
  };

  conversations.forEach((conv) => {
    const d = new Date(conv.updatedAt);
    if (isSameDay(d, today)) {
      grouped.today.push(conv);
    } else if (isSameDay(d, yesterday)) {
      grouped.yesterday.push(conv);
    } else if (d > sevenDaysAgo) {
      grouped.previous7days.push(conv);
    } else {
      grouped.older.push(conv);
    }
  });

  return (
    <>
      <SecondaryHeader icon={ChatIcon} title="Chat" subtitle="Conversations" onClose={onClose} />

      <div style={{ padding: "0 10px", marginBottom: 12 }}>
        <button
          onClick={onNewChat}
          style={{
            width: "100%",
            padding: "8px",
            background: "var(--accent-tint)",
            color: "var(--accent-text)",
            border: "1px dashed var(--accent-border)",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "background 0.15s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-tint-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-tint)")}
        >
          <span style={{ fontSize: 16 }}>+</span> New chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 20 }}>
        {grouped.today.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionLabel label="Today" collapsed={false} />
            {grouped.today.map((c) => (
              <NavBtn
                key={c.id}
                icon={ChatIcon}
                label={c.title || "New chat"}
                active={activeNav === `chat-${c.id}`}
                onClick={() => onSelectNav(`chat-${c.id}`)}
              />
            ))}
          </div>
        )}
        
        {grouped.yesterday.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionLabel label="Yesterday" collapsed={false} />
            {grouped.yesterday.map((c) => (
              <NavBtn
                key={c.id}
                icon={ChatIcon}
                label={c.title || "New chat"}
                active={activeNav === `chat-${c.id}`}
                onClick={() => onSelectNav(`chat-${c.id}`)}
                muted
              />
            ))}
          </div>
        )}

        {grouped.previous7days.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionLabel label="Previous 7 Days" collapsed={false} />
            {grouped.previous7days.map((c) => (
              <NavBtn
                key={c.id}
                icon={ChatIcon}
                label={c.title || "New chat"}
                active={activeNav === `chat-${c.id}`}
                onClick={() => onSelectNav(`chat-${c.id}`)}
                muted
              />
            ))}
          </div>
        )}

        {grouped.older.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionLabel label="Older" collapsed={false} />
            {grouped.older.map((c) => (
              <NavBtn
                key={c.id}
                icon={ChatIcon}
                label={c.title || "New chat"}
                active={activeNav === `chat-${c.id}`}
                onClick={() => onSelectNav(`chat-${c.id}`)}
                muted
              />
            ))}
          </div>
        )}
      </div>

      {otherWorkspaces.length > 0 && (
        <>
          <Divider />
          <div style={{ marginBottom: 8 }}>
            <SectionLabel label="Other Workspaces" collapsed={false} />
            {otherWorkspaces.map((w) => (
              <NavBtn
                key={w.id}
                icon={w.icon}
                label={w.label}
                muted
                onClick={() => onSwitchWorkspace(w.id)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ─── Main Nav (Column 1 - Primary Sidebar) ──────────────────────────────────────

function PrimaryNav({
  activeNav,
  activeWorkspace,
  collapsed,
  onSelectNav,
  onGoBack,
  onSelectWorkspace,
  router,
  isAdmin = false,
}: {
  activeNav: string;
  activeWorkspace: WorkspaceId | null;
  inboxBadge: number;
  collapsed: boolean;
  onSelectNav: (nav: string) => void;
  onOpenCalendar: () => void;
  onGoBack: () => void;
  onSelectWorkspace: (id: WorkspaceId) => void;
  router: ReturnType<typeof useRouter>;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [conversations, setConversations] = useState<SidebarConversation[]>([]);

  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await fetch("/api/conversations");
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      } catch (e) {
        log.error("Failed to load conversations", { error: e });
      }
    }
    loadConversations();
  }, []);

  return (
    <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
      {/* ── ACTIONS ── */}
      <div style={{ marginBottom: collapsed ? 14 : 20 }}>
        <PrimaryActionBtn
          icon={ChatIcon}
          label="New Chat"
          collapsed={collapsed}
          onClick={() => {
            onSelectNav("chat");
            onGoBack();
          }}
        />
      </div>

      {/* ── WORKSPACES ── */}
      <div style={{ marginBottom: collapsed ? 14 : 20 }}>
        <SectionLabel label="Workspaces" collapsed={collapsed} />
        <WorkspaceRow
          dataTour="gmail"
          icon={GmailIcon}
          label="Gmail"
          active={activeWorkspace === "gmail"}
          onClick={() => onSelectWorkspace("gmail")}
          collapsed={collapsed}
        />
        <WorkspaceRow
          dataTour="calendar"
          icon={CalendarIcon}
          label="Calendar"
          active={activeWorkspace === "calendar"}
          onClick={() => {
            onSelectWorkspace("calendar");
            router.push("/dashboard/calendar");
          }}
          collapsed={collapsed}
        />
        <WorkspaceRow
          icon={OutlookIcon}
          label="Outlook"
          active={activeWorkspace === "outlook"}
          onClick={() => onSelectWorkspace("outlook")}
          collapsed={collapsed}
        />
      </div>

      {!collapsed && <Divider />}

      {/* ── CHATS ── */}
      <div style={{ marginBottom: collapsed ? 14 : 20, marginTop: collapsed ? 0 : 4 }}>
        <SectionLabel label="Chats" collapsed={collapsed} />
        {conversations.length > 0 ? (
          conversations.slice(0, 5).map((c) => (
            <NavBtn
              key={c.id}
              icon={ChatIcon}
              label={c.title || "New chat"}
              active={activeNav === `chat-${c.id}`}
              collapsed={collapsed}
              muted
              onClick={() => {
                onSelectNav(`chat-${c.id}`);
              }}
            />
          ))
        ) : (
          !collapsed && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                padding: "8px 12px",
                fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                fontStyle: "italic",
              }}
            >
              Nothing to show. Start a new chat to see history.
            </div>
          )
        )}
      </div>

      {!collapsed && <Divider />}

      {/* ── TOOLS ── */}
      <div style={{ marginBottom: collapsed ? 14 : 8, marginTop: collapsed ? 0 : 4 }}>
        <SectionLabel label="Tools" collapsed={collapsed} />
        <NavBtn
          icon={SearchIcon}
          label="Search"
          active={activeNav === "search"}
          collapsed={collapsed}
          onClick={() => onSelectNav("search")}
        />
        <NavBtn
          icon={CommandIcon}
          label="Command"
          active={activeNav === "command"}
          collapsed={collapsed}
          onClick={() => onSelectNav("command")}
        />
      </div>

      {/* ── ADMIN (Admins only) ── */}
      {isAdmin && (
        <>
          {!collapsed && <Divider />}
          <div style={{ marginBottom: collapsed ? 14 : 8, marginTop: collapsed ? 0 : 4 }}>
            <SectionLabel label="Admin" collapsed={collapsed} />
            <NavBtn
              icon={UsersIcon}
              label="Waitlist"
              active={activeNav === "admin-waitlist" || (pathname != null && pathname.startsWith("/dashboard/admin"))}
              collapsed={collapsed}
              onClick={() => {
                onSelectNav("admin-waitlist");
                router.push("/dashboard/admin/waitlist");
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sidebar root ─────────────────────────────────────────────────────────────

const WORKSPACE_META: Record<WorkspaceId, { icon: IconComponent; label: string }> = {
  gmail: { icon: GmailIcon, label: "Gmail" },
  calendar: { icon: CalendarIcon, label: "Calendar" },
  outlook: { icon: OutlookIcon, label: "Outlook" },
  chat: { icon: ChatIcon, label: "Chat" },
};

export function Sidebar({
  activeNav,
  onSelectNav,
  onOpenCalendar,
  onGoBack,
  user = CURRENT_USER,
  inboxBadge = 0,
  collapsed: propCollapsed,
  onToggleCollapse: propOnToggleCollapse,
  activeWorkspace: propActiveWorkspace,
  onSelectWorkspace: propOnSelectWorkspace,
  secondaryOpen: propSecondaryOpen,
  onToggleSecondary: propOnToggleSecondary,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isAccountActive = pathname === "/dashboard/account" || activeNav === "account";
  const handleOpenAccount = () => {
    router.push("/dashboard/account");
  };
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/status")
      .then((res) => (res.ok ? res.json() : { isAdmin: false }))
      .then((data) => {
        if (active && data?.isAdmin) {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [internalActiveWorkspace, setInternalActiveWorkspace] = useState<WorkspaceId | null>(null);
  const [internalSecondaryOpen, setInternalSecondaryOpen] = useState(true);

  // Determine active workspace
  const currentWorkspace =
    propActiveWorkspace !== undefined ? propActiveWorkspace : internalActiveWorkspace;

  // Primary sidebar collapsed state: starts collapsed when workspace is active, but user can open/close!
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    return propActiveWorkspace !== undefined && propActiveWorkspace !== null;
  });

  const [prevPropActiveWorkspace, setPrevPropActiveWorkspace] = useState(propActiveWorkspace);
  if (propActiveWorkspace !== prevPropActiveWorkspace) {
    setPrevPropActiveWorkspace(propActiveWorkspace);
    if (propActiveWorkspace && propCollapsed === undefined) {
      setInternalCollapsed(true);
    }
  }

  const isPrimaryCollapsed =
    propCollapsed !== undefined ? propCollapsed : internalCollapsed;

  // Secondary panel open state
  const isSecondaryOpen =
    propSecondaryOpen !== undefined ? propSecondaryOpen : internalSecondaryOpen;

  const handleTogglePrimary = () => {
    if (propOnToggleCollapse) {
      propOnToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const handleToggleSecondary = () => {
    if (propOnToggleSecondary) {
      propOnToggleSecondary();
    } else {
      setInternalSecondaryOpen((prev) => !prev);
    }
  };

  const handleSelectWorkspace = (id: WorkspaceId) => {
    setInternalCollapsed(true);
    if (propOnSelectWorkspace) {
      propOnSelectWorkspace(id);
    } else {
      // Toggle secondary if already on same workspace, else activate
      if (currentWorkspace === id) {
        setInternalSecondaryOpen((prev) => !prev);
      } else {
        setInternalActiveWorkspace(id);
        setInternalSecondaryOpen(true);
      }
    }

    if (id === "gmail") {
      router.push("/dashboard/inbox");
    } else if (id === "calendar") {
      router.push("/dashboard/calendar");
    }
  };

  const handleSwitchWorkspace = (id: WorkspaceId) => {
    setInternalCollapsed(true);
    if (propOnSelectWorkspace) {
      propOnSelectWorkspace(id);
    } else {
      setInternalActiveWorkspace(id);
      setInternalSecondaryOpen(true);
    }
    if (id === "gmail") {
      router.push("/dashboard/inbox");
    } else if (id === "calendar") {
      router.push("/dashboard/calendar");
    }
  };

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
    : user;

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
          router.refresh();
        },
      },
    });
  }

  const otherWorkspaces = (Object.keys(WORKSPACE_META) as WorkspaceId[])
    .filter((id) => id !== currentWorkspace)
    .map((id) => ({ id, ...WORKSPACE_META[id] }));

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* ── 1. PRIMARY SIDEBAR COLUMN (60px when workspace active, 210px when root) ── */}
      <aside
        style={{
          width: isPrimaryCollapsed ? 60 : 210,
          flexShrink: 0,
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-hairline)",
          display: "flex",
          flexDirection: "column",
          padding: isPrimaryCollapsed ? "0 6px 14px" : "0 10px 14px",
          overflowY: "hidden",
          transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1), padding 0.22s",
        }}
      >
        {/* Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isPrimaryCollapsed ? "center" : "space-between",
            padding: isPrimaryCollapsed ? "18px 0 16px" : "18px 6px 18px 8px",
            flexShrink: 0,
          }}
        >
          <div
            onClick={isPrimaryCollapsed ? handleTogglePrimary : () => router.push("/dashboard")}
            title={isPrimaryCollapsed ? "Open sidebar" : "Command Inbox Dashboard"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              cursor: "pointer",
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: "linear-gradient(140deg, var(--accent-solid) 0%, var(--accent-hover) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px var(--shadow-color)",
                flexShrink: 0,
              }}
            >
              <LogoIcon />
            </div>
            {!isPrimaryCollapsed && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.025em",
                  whiteSpace: "nowrap",
                }}
              >
                Nexus
              </span>
            )}
          </div>

          {!isPrimaryCollapsed && (
            <button
              onClick={handleTogglePrimary}
              title="Collapse sidebar"
              style={{
                background: "transparent",
                border: "none",
                borderRadius: 5,
                padding: "4px 5px",
                cursor: "pointer",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <SidebarToggleIcon size={14} />
            </button>
          )}
        </div>

        {/* Primary nav items */}
        <PrimaryNav
          activeNav={activeNav}
          activeWorkspace={currentWorkspace}
          inboxBadge={inboxBadge}
          collapsed={isPrimaryCollapsed}
          onSelectNav={onSelectNav}
          onOpenCalendar={onOpenCalendar}
          onGoBack={onGoBack}
          onSelectWorkspace={handleSelectWorkspace}
          router={router}
          isAdmin={isAdmin}
        />

        {/* Footer */}
        <SidebarFooter
          collapsed={isPrimaryCollapsed}
          handleToggle={handleTogglePrimary}
          displayUser={displayUser}
          handleLogout={handleLogout}
          onOpenAccount={handleOpenAccount}
          isAccountActive={isAccountActive}
        />
      </aside>

      {/* ── 2. SECONDARY CONTEXTUAL SIDEBAR COLUMN (Appears after collapsed sidebar) ── */}
      {currentWorkspace && (
        <aside
          style={{
            width: isSecondaryOpen ? 200 : 0,
            opacity: isSecondaryOpen ? 1 : 0,
            flexShrink: 0,
            background: "var(--bg-sidebar-secondary)",
            borderRight: isSecondaryOpen ? "1px solid var(--border-hairline)" : "none",
            display: "flex",
            flexDirection: "column",
            padding: isSecondaryOpen ? "0 10px 14px" : 0,
            overflowY: "auto",
            overflowX: "hidden",
            transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease, padding 0.22s",
            whiteSpace: "nowrap",
          }}
        >
          {isSecondaryOpen && (
            <>
              {currentWorkspace === "gmail" && (
                <GmailSecondaryPanel
                  activeNav={activeNav}
                  inboxBadge={inboxBadge}
                  otherWorkspaces={otherWorkspaces}
                  onSelectNav={onSelectNav}
                  onSwitchWorkspace={handleSwitchWorkspace}
                  onClose={handleToggleSecondary}
                />
              )}

              {currentWorkspace === "calendar" && (
                <CalendarSecondaryPanel
                  activeNav={activeNav}
                  otherWorkspaces={otherWorkspaces}
                  onSelectNav={onSelectNav}
                  onSwitchWorkspace={handleSwitchWorkspace}
                  onClose={handleToggleSecondary}
                  router={router}
                />
              )}

              {currentWorkspace === "outlook" && (
                <OutlookSecondaryPanel
                  activeNav={activeNav}
                  otherWorkspaces={otherWorkspaces}
                  onSelectNav={onSelectNav}
                  onSwitchWorkspace={handleSwitchWorkspace}
                  onClose={handleToggleSecondary}
                />
              )}

              {currentWorkspace === "chat" && (
                <ChatSecondaryPanel
                  activeNav={activeNav}
                  otherWorkspaces={otherWorkspaces}
                  onSelectNav={onSelectNav}
                  onSwitchWorkspace={handleSwitchWorkspace}
                  onClose={handleToggleSecondary}
                  onNewChat={() => {
                    onSelectNav("chat-new");
                  }}
                />
              )}
            </>
          )}
        </aside>
      )}
    </div>
  );
}
