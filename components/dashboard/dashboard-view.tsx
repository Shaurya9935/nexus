"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { View, Email, UserProfile, ServiceConnection, FocusItem } from "./types";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { DefaultWorkspace } from "./default-workspace";
import { EmailThreadView } from "../inbox/email-thread-view";
import { CalendarView } from "./calendar-view";
import { RightPanel } from "./right-panel";
import {
  CURRENT_USER,
} from "./mock-data";
import { useGmailThreads, GmailThread } from "@/hooks/use-gmail";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { useCurrentTime } from "@/hooks/use-current-time";
import { useIntegrations } from "@/hooks/use-integrations";

export interface DashboardViewProps {
  initialUser?: UserProfile;
  initialEmails?: Email[];
  connections?: ServiceConnection[];
}

const PALETTE_COLORS = [
  "var(--avatar-1)",
  "var(--avatar-2)",
  "var(--avatar-3)",
  "var(--avatar-4)",
  "var(--avatar-5)",
  "var(--avatar-6)",
];

function formatSenderName(fromRaw: string): string {
  if (!fromRaw) return "Unknown sender";
  const match = fromRaw.match(/^(.*?)\s*<.*?>$/);
  if (match && match[1]?.trim()) {
    return match[1].replace(/^["']|["']$/g, "").trim();
  }
  if (fromRaw.includes("@") && !fromRaw.includes(" ")) {
    return fromRaw.split("@")[0];
  }
  return fromRaw.trim();
}

function formatEmailTime(dateVal: string | Date | undefined): string {
  if (!dateVal) return "Recent";
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) return "Recent";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
}

function mapThreadToEmail(thread: GmailThread, index: number): Email {
  const data = thread?.data || thread || {};
  const id = thread?.entity_id || thread?.id || data?.id || `thread-${index}`;
  const snippet = data?.snippet || thread?.snippet || "";
  const rawFrom = data?.from || thread?.from || "";
  const from = formatSenderName(rawFrom);
  const subject =
    data?.subject ||
    thread?.subject ||
    (snippet ? (snippet.length > 40 ? snippet.slice(0, 40) + "…" : snippet) : `Thread #${String(id).slice(0, 6)}`);
  const preview = snippet || data?.body || "No preview available";

  const initials =
    from
      .split(" ")
      .map((w: string) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "GM";

  const color = PALETTE_COLORS[index % PALETTE_COLORS.length];

  const dateVal =
    thread?.created_at ||
    data?.created_at ||
    thread?.createdAt ||
    data?.createdAt;
  const time = formatEmailTime(dateVal);

  const unread =
    thread?.unread !== undefined
      ? Boolean(thread.unread)
      : data?.unread !== undefined
      ? Boolean(data?.unread)
      : true;
  const tag = data?.tag || (unread ? "Needs reply" : "Inbox");

  const body = thread?.body || data?.body || "";
  const bodyHtml = thread?.bodyHtml || data?.bodyHtml || "";

  return {
    id,
    from,
    initials,
    color,
    subject,
    preview,
    time,
    unread,
    tag,
    body,
    bodyHtml,
  };
}

export function DashboardView({
  initialUser = CURRENT_USER,
}: DashboardViewProps) {
  const router = useRouter();
  const [view, setView] = useState<View>("default");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [activeNav, setActiveNav] = useState("chat");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [readEmailIds, setReadEmailIds] = useState<Set<string | number>>(new Set());
  const nowMs = useCurrentTime();

  // Connection status & actions
  const {
    isGmailConnected,
    isCalendarConnected,
    isLoading: integrationsLoading,
    connectGmail,
    connectCalendar,
  } = useIntegrations();

  // Fetch threads using the useGmailThreads hook
  const { threads, isLoading: threadsLoading, isNotConnected: gmailNotConnected } = useGmailThreads();
  const { todayEvents, nextEvent: calendarNextEvent, isNotConnected: calendarNotConnected } = useCalendarEvents();

  const isGmailActive = !integrationsLoading ? isGmailConnected : !gmailNotConnected;
  const isCalendarActive = !integrationsLoading ? isCalendarConnected : !calendarNotConnected;
  const isLoading = threadsLoading || integrationsLoading;

  // Map API threads to UI emails format, applying local read overrides
  const emails: Email[] = useMemo(() => {
    if (!isGmailActive || !Array.isArray(threads) || threads.length === 0) {
      return [];
    }
    return threads.map((thread, idx) => {
      const email = mapThreadToEmail(thread, idx);
      if (readEmailIds.has(email.id)) {
        return { ...email, unread: false };
      }
      return email;
    });
  }, [threads, isGmailActive, readEmailIds]);

  const liveConnections: ServiceConnection[] = useMemo(() => [
    { label: "Gmail", ok: isGmailActive },
    { label: "Google Calendar", ok: isCalendarActive },
    { label: "Nexus AI", ok: true },
  ], [isGmailActive, isCalendarActive]);

  const goBack = () => {
    setView("default");
    setSelectedEmail(null);
  };

  const openEmail = (e: Email) => {
    setSelectedEmail(e);
    setView("email");
    setReadEmailIds((prev) => new Set(prev).add(e.id));
  };

  const openCalendar = () => {
    setActiveNav("today");
    setView("calendar");
  };

  const handleNavSelect = (nav: string) => {
    setActiveNav(nav);
    if (nav === "today") {
      setView("calendar");
    } else if (nav === "inbox") {
      router.push("/dashboard/inbox");
    } else if (nav === "chat" || nav === "chat-new") {
      setView("default");
      setSelectedEmail(null);
      setActiveConversationId(null);
    } else if (nav.startsWith("chat-")) {
      setView("default");
      setSelectedEmail(null);
      setActiveConversationId(nav.replace("chat-", ""));
    } else if (nav === "starred") {
      router.push("/dashboard/inbox?folder=starred");
    } else if (nav === "drafts" || nav === "sent") {
      router.push(`/dashboard/inbox?folder=${nav}`);
    }
  };

  const dynamicFocusItems: FocusItem[] = useMemo(() => {
    const unreadCount = emails.filter((e) => e.unread).length;
    const meetingCount = todayEvents.length;

    let nextMeetingStr = "—";
    let nextMeetingLabel = isCalendarActive ? "no upcoming meetings" : "calendar offline";

    if (isCalendarActive && calendarNextEvent?.startIso) {
      const startMs = new Date(calendarNextEvent.startIso).getTime();
      if (!isNaN(startMs)) {
        const currentMs = nowMs ?? startMs;
        const diffMin = Math.max(
          0,
          Math.round((startMs - currentMs) / 60000)
        );
        if (!isNaN(diffMin)) {
          if (diffMin < 60) nextMeetingStr = `${diffMin}m`;
          else nextMeetingStr = `${Math.floor(diffMin / 60)}h`;
          nextMeetingLabel = `until ${calendarNextEvent.label}`;
        }
      }
    }

    if (!isGmailActive && !isCalendarActive) {
      return [
        {
          count: "—",
          label: "Connect Gmail to see your focus",
          action: "email",
        },
        {
          count: "—",
          label: "Connect Calendar to track schedule",
          action: "calendar",
        },
      ];
    }

    return [
      {
        count: isGmailActive ? String(unreadCount) : "—",
        label: isGmailActive ? "emails need attention" : "Connect Gmail to see your focus",
        action: "email",
      },
      {
        count: isCalendarActive ? String(meetingCount) : "—",
        label: isCalendarActive ? (meetingCount === 1 ? "meeting today" : "meetings today") : "Connect Calendar to track schedule",
        action: "calendar",
      },
      isGmailActive
        ? { count: "0", label: "drafts waiting", action: "email" }
        : { count: "—", label: "Connect Gmail for drafts", action: "email" },
      {
        count: nextMeetingStr,
        label: nextMeetingLabel,
        action: "calendar",
      },
    ];
  }, [emails, todayEvents, calendarNextEvent, nowMs, isGmailActive, isCalendarActive]);

  const inboxBadgeCount = isGmailActive ? (emails.filter((e) => e.unread).length || emails.length || 0) : 0;

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
        activeNav={activeNav}
        onSelectNav={handleNavSelect}
        onOpenCalendar={openCalendar}
        onGoBack={goBack}
        user={initialUser}
        inboxBadge={inboxBadgeCount}
      />

      {/* ── Center Area ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg-workspace)",
          minWidth: 0,
        }}
      >
        {/* Top bar */}
        <TopBar
          view={view}
          selectedEmail={selectedEmail}
          statusOpen={statusOpen}
          onToggleStatus={() => setStatusOpen((prev) => !prev)}
          onCloseStatus={() => setStatusOpen(false)}
          connections={liveConnections}
          user={initialUser}
        />

        {/* Dynamic Workspace Switcher */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {view === "email" && selectedEmail ? (
            <EmailThreadView email={selectedEmail} onBack={goBack} />
          ) : view === "calendar" ? (
            <CalendarView
              events={todayEvents}
              onBack={goBack}
              isCalendarConnected={isCalendarActive}
              onConnectCalendar={connectCalendar}
            />
          ) : (
            <DefaultWorkspace
              onSelectEmail={openEmail}
              onSelectCalendar={openCalendar}
              onSelectInbox={() => router.push("/dashboard/inbox")}
              user={initialUser}
              focusItems={dynamicFocusItems}
              emails={emails}
              isLoading={isLoading}
              activeConversationId={activeConversationId}
              onActiveConversationChange={setActiveConversationId}
              isGmailConnected={isGmailActive}
              onConnectGmail={connectGmail}
            />
          )}
        </div>
      </div>

      {/* ── Right context panel ── */}
      <RightPanel
        events={todayEvents}
        onOpenCalendar={openCalendar}
        onOpenNextEvent={openCalendar}
        isCalendarConnected={isCalendarActive}
        onConnectCalendar={connectCalendar}
      />
    </div>
  );
}
