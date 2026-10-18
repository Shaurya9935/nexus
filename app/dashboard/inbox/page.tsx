"use client";

import React, { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { log } from "@/lib/logger";
import { useRouter, useSearchParams } from "next/navigation";
import { useGmailThreads, GmailThread } from "@/hooks/use-gmail";
import { useCurrentTime } from "@/hooks/use-current-time";
import { Email } from "@/components/dashboard/types";
import { Avatar } from "@/components/dashboard/avatar";
import { Dot } from "@/components/dashboard/dot";
import { Sidebar } from "@/components/dashboard/sidebar";
import { EmailBodyContent } from "@/components/inbox/email-body";
import { StarredView } from "@/components/inbox/starred-view";
import { GmailConnectView } from "@/components/inbox/gmail-connect-view";
import { useIntegrations } from "@/hooks/use-integrations";
import { GmailBrandIcon } from "@/components/connect/brand-icons";
import {
  InboxIcon,
  StarIcon,
  DraftIcon,
  SendIcon,
  AllMailIcon,
  SpamIcon,
  TrashIcon,
  LabelIcon,
  SearchIcon,
  ReplyIcon,
  PaperclipIcon,
  SidebarToggleIcon,
} from "@/components/dashboard/icons";

const PALETTE_COLORS = [
  "var(--avatar-purple)",
  "var(--avatar-teal)",
  "var(--avatar-amber)",
  "var(--avatar-indigo)",
  "var(--avatar-emerald)",
  "var(--avatar-coral)",
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
    (snippet
      ? snippet.length > 40
        ? snippet.slice(0, 40) + "…"
        : snippet
      : `Thread #${String(id).slice(0, 6)}`);
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

function InboxInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderParam = searchParams.get("folder");
  const [folderState, setFolderState] = useState<string | null>(null);
  const activeFolder = folderParam || folderState || "inbox";
  const setActiveFolder = (folder: string) => setFolderState(folder);
  const [starredIds, setStarredIds] = useState<Set<string | number>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [secondaryOpen, setSecondaryOpen] = useState(true);
  const { isGmailConnected, isConnectingGmail, connectGmail, isLoading: integrationsLoading } = useIntegrations();
  const {
    threads,
    isLoading: isThreadsLoading,
    isSyncing,
    error,
    lastSyncedAt,
    sync,
    isNotConnected: gmailNotConnected,
  } = useGmailThreads();

  const isNotConnected = gmailNotConnected || (!integrationsLoading && !isGmailConnected);
  const isLoading = isThreadsLoading || integrationsLoading;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [readIds, setReadIds] = useState<Set<string | number>>(new Set());
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [failedBodyThreadIds, setFailedBodyThreadIds] = useState<Set<string>>(new Set());
  const [fullBodies, setFullBodies] = useState<Record<string, { body?: string; bodyHtml?: string }>>({});
  const currentMs = useCurrentTime();

  const handleToggleStar = (e: React.MouseEvent, emailId: string | number) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) next.delete(emailId);
      else next.add(emailId);
      return next;
    });
  };

  // Map and filter emails
  const emails: Email[] = useMemo(() => {
    if (!Array.isArray(threads)) return [];
    return threads.map((thread, idx) => {
      const email = mapThreadToEmail(thread, idx);
      const isRead = readIds.has(email.id);
      const isStarred = starredIds.has(email.id);
      return {
        ...email,
        unread: isRead ? false : email.unread,
        starred: isStarred,
      };
    });
  }, [threads, readIds, starredIds]);

  const filteredEmails = useMemo(() => {
    let result = emails;

    // Filter by active folder
    if (activeFolder === "starred") {
      result = result.filter((e) => e.starred);
    } else if (activeFolder === "drafts") {
      result = result.filter((e) => e.tag?.toLowerCase().includes("draft"));
    } else if (activeFolder === "sent") {
      result = result.filter((e) => e.tag?.toLowerCase().includes("sent") || e.tag === "Needs reply");
    } else if (activeFolder === "spam") {
      result = result.filter((e) => e.tag?.toLowerCase().includes("spam"));
    } else if (activeFolder === "trash") {
      result = result.filter((e) => e.tag?.toLowerCase().includes("trash"));
    } else if (activeFolder.startsWith("label-")) {
      const labelName = activeFolder.replace("label-", "").toLowerCase();
      result = result.filter(
        (e) => e.tag?.toLowerCase().includes(labelName) || e.preview?.toLowerCase().includes(labelName)
      );
    }

    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(
      (e) =>
        e.from.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        e.preview.toLowerCase().includes(q)
    );
  }, [emails, activeFolder, searchQuery]);

  // Selected email
  const selectedEmail = useMemo(() => {
    if (!selectedId) return filteredEmails[0] || null;
    return emails.find((e) => e.id === selectedId) || filteredEmails[0] || null;
  }, [emails, filteredEmails, selectedId]);

  const selectedEmailIdStr = selectedEmail?.id ? String(selectedEmail.id) : null;
  const isRealThread = Boolean(selectedEmailIdStr && !selectedEmailIdStr.startsWith("thread-"));
  const cachedFullBody = selectedEmailIdStr ? fullBodies[selectedEmailIdStr] : undefined;
  const hasSelectedBody = Boolean(
    selectedEmail?.bodyHtml ||
      selectedEmail?.body ||
      cachedFullBody?.bodyHtml ||
      cachedFullBody?.body
  );

  const isSelectedBodyLoading = Boolean(
    isRealThread &&
      !hasSelectedBody &&
      selectedEmailIdStr &&
      !failedBodyThreadIds.has(selectedEmailIdStr)
  );

  const inFlightRef = useRef<Set<string>>(new Set());
  const fetchedThreadIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedEmail?.id) return;
    const idStr = String(selectedEmail.id);
    if (!idStr || idStr.startsWith("thread-")) return;

    // Do not fetch if the body is already present on the selected email,
    // already fetched in fullBodies, already requested in fetchedThreadIdsRef,
    // marked as failed, or currently in-flight.
    if (
      selectedEmail.bodyHtml ||
      selectedEmail.body ||
      fullBodies[idStr] !== undefined ||
      fetchedThreadIdsRef.current.has(idStr) ||
      failedBodyThreadIds.has(idStr) ||
      inFlightRef.current.has(idStr)
    ) {
      return;
    }

    let isMounted = true;
    inFlightRef.current.add(idStr);
    fetchedThreadIdsRef.current.add(idStr);

    fetch(`/api/gmail/threads/${idStr}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch thread: HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted && data) {
          setFullBodies((prev) => ({
            ...prev,
            [idStr]: {
              body: data.body || "",
              bodyHtml: data.bodyHtml || "",
            },
          }));
        }
      })
      .catch((err) => {
        log.warn("Failed to fetch full thread body", { error: err });
        if (isMounted) {
          setFailedBodyThreadIds((prev) => new Set(prev).add(idStr));
        }
      })
      .finally(() => {
        inFlightRef.current.delete(idStr);
      });

    return () => {
      isMounted = false;
    };
  }, [
    selectedEmail?.id,
    selectedEmail?.bodyHtml,
    selectedEmail?.body,
    fullBodies,
    failedBodyThreadIds,
  ]);

  const handleSelect = (email: Email) => {
    setSelectedId(email.id);
    setReadIds((prev) => new Set(prev).add(email.id));
    setReplyError(null);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedEmail || isSendingReply) return;

    setIsSendingReply(true);
    setReplyError(null);

    try {
      const emailIdStr = String(selectedEmail.id);
      const isRealThread = !emailIdStr.startsWith("thread-");

      const currentThread = threads.find(
        (t) => (t.entity_id || t.id || t.data?.id) === selectedEmail.id
      );
      const rawFrom = currentThread?.data?.from || currentThread?.from;

      const res = await fetch("/api/gmail/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: isRealThread ? emailIdStr : undefined,
          to: rawFrom || selectedEmail.from,
          subject: selectedEmail.subject
            ? selectedEmail.subject.toLowerCase().startsWith("re:")
              ? selectedEmail.subject
              : `Re: ${selectedEmail.subject}`
            : undefined,
          body: replyText.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Send failed (${res.status})`);
      }

      setReplyText("");
      sync().catch(() => {});
    } catch (err) {
      log.error("Failed to send reply", { error: err });
      setReplyError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setIsSendingReply(false);
    }
  };

  const unreadCount = emails.filter((e) => e.unread).length;

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        background: "var(--bg-main)",
        fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
        overflow: "hidden",
      }}
    >
      {/* ── Sidebar (Collapsed 60px primary + 200px secondary Gmail sidebar) ── */}
      <Sidebar
        activeWorkspace="gmail"
        activeNav={activeFolder}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        secondaryOpen={secondaryOpen}
        onToggleSecondary={() => setSecondaryOpen((prev) => !prev)}
        onSelectNav={(nav) => {
          if (
            ["inbox", "starred", "drafts", "sent", "all-mail", "spam", "trash"].includes(nav) ||
            nav.startsWith("label-")
          ) {
            setActiveFolder(nav);
            if (nav === "inbox") {
               router.push("/dashboard/inbox");
            } else {
              router.push(`/dashboard/inbox?folder=${encodeURIComponent(nav)}`);
            }
          } else if (nav === "calendar" || nav === "today" || nav === "upcoming") {
            router.push("/dashboard/calendar");
          } else {
            router.push("/dashboard");
          }
        }}
        onOpenCalendar={() => router.push("/dashboard/calendar")}
        onGoBack={() => router.push("/dashboard")}
        inboxBadge={unreadCount}
      />

      {activeFolder === "starred" ? (
        <StarredView
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
        />
      ) : (
        /* ── Main Inbox Content Area ── */
        <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
          background: "var(--bg-main)",
        }}
      >
        {/* ── Top Header Bar ── */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 28px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
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
                border: "1px solid var(--border-subtle)",
                borderRadius: 6,
                padding: "4px 6px",
                cursor: "pointer",
                color: "var(--text-secondary)",
                transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <SidebarToggleIcon size={14} />
            </button>
            <div style={{ width: 1, height: 16, background: "var(--border-subtle)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--brand-accent)", display: "flex" }}>
                {activeFolder === "starred" ? (
                  <StarIcon size={16} />
                ) : activeFolder === "drafts" ? (
                  <DraftIcon size={16} />
                ) : activeFolder === "sent" ? (
                  <SendIcon size={16} />
                ) : activeFolder === "all-mail" ? (
                  <AllMailIcon size={16} />
                ) : activeFolder === "trash" ? (
                  <TrashIcon size={16} />
                ) : activeFolder === "spam" ? (
                  <SpamIcon size={16} />
                ) : activeFolder.startsWith("label-") ? (
                  <LabelIcon size={16} />
                ) : (
                  <InboxIcon size={16} />
                )}
              </span>
              <h1
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  margin: 0,
                  letterSpacing: "-0.02em",
                  textTransform: "capitalize",
                }}
              >
                {activeFolder.startsWith("label-")
                  ? `Label: ${activeFolder.replace("label-", "")}`
                  : activeFolder === "all-mail"
                  ? "All Mail"
                  : activeFolder}
              </h1>
              {isNotConnected ? (
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    color: "var(--status-warning-text)",
                    background: "var(--status-warning-bg)",
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
                    color: unreadCount > 0 ? "var(--brand-accent)" : "var(--text-muted)",
                    background: unreadCount > 0 ? "var(--brand-accent-subtle)" : "var(--border-subtle)",
                    padding: "2px 7px",
                    borderRadius: 12,
                    fontWeight: 500,
                  }}
                >
                  {unreadCount} unread
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
              background: "var(--bg-inset)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "6px 12px",
              width: 260,
            }}
          >
            <span style={{ color: "var(--text-muted)", display: "flex" }}>
              <SearchIcon size={13} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isNotConnected ? "Connect Gmail to search messages…" : "Search messages…"}
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
              onClick={() => connectGmail()}
              disabled={isConnectingGmail}
              title="Connect your Gmail account"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                background: isConnectingGmail ? "var(--brand-accent-hover)" : "var(--brand-accent)",
                color: "var(--text-inverse)",
                border: "none",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: isConnectingGmail ? "default" : "pointer",
                opacity: isConnectingGmail ? 0.85 : 1,
                fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
                transition: "background 0.15s, opacity 0.15s",
              }}
            >
              <GmailBrandIcon size={14} />
              <span>{isConnectingGmail ? "Connecting…" : "Connect Gmail"}</span>
            </button>
          ) : (
            <button
              onClick={() => sync()}
              disabled={isSyncing}
              title="Fetch latest emails from Gmail"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                background: isSyncing ? "var(--brand-accent-hover)" : "var(--brand-accent)",
                color: "var(--text-inverse)",
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
              {/* Spinner SVG shown while syncing */}
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
                <circle
                  cx="8" cy="8" r="6"
                  stroke="currentColor"
                  strokeOpacity="0.35"
                  strokeWidth="1.8"
                />
                <path
                  d="M8 2a6 6 0 016 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              {isSyncing ? "Syncing…" : "Refresh"}
            </button>
          )}
        </div>
      </header>

      {/* ── Error Banner if any ── */}
      {error && !isNotConnected && (
        <div
          style={{
            padding: "10px 28px",
            background: "var(--status-error-bg)",
            borderBottom: "1px solid var(--status-error-border)",
            color: "var(--status-error-text)",
            fontSize: 12.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Error loading emails: {error}</span>
          <button
            onClick={() => sync()}
            style={{
              background: "none",
              border: "none",
              color: "var(--status-error-text)",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 12,
              textDecoration: "underline",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Main Content Area (Connect View or Two-Pane Container) ── */}
      {isNotConnected && !isLoading ? (
        <GmailConnectView onConnect={connectGmail} isConnecting={isConnectingGmail} />
      ) : (
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Left Pane: Email Thread List */}
        <div
          style={{
            width: 380,
            flexShrink: 0,
            borderRight: "1px solid var(--border-subtle)",
            background: "var(--bg-main)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {isLoading && emails.length === 0 ? (
            <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  style={{
                    display: "flex",
                    gap: 12,
                    opacity: 0.5,
                    animation: "fade-in 1s infinite alternate",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "var(--border-subtle)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ width: "45%", height: 12, background: "var(--border-subtle)", borderRadius: 4 }} />
                    <div style={{ width: "80%", height: 10, background: "var(--bg-inset)", borderRadius: 4 }} />
                    <div style={{ width: "60%", height: 9, background: "var(--bg-inset)", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEmails.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "36px 24px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <InboxIcon size={32} />
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  margin: "12px 0 4px",
                }}
              >
                No messages found
              </p>
              <p style={{ fontSize: 12.5, margin: 0 }}>
                {searchQuery ? "No matches for your search" : "Your inbox is completely caught up"}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {filteredEmails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;
                return (
                  <div
                    key={email.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelect(email)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelect(email);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "16px 20px",
                      background: isSelected ? "var(--bg-card)" : "transparent",
                      borderBottom: "1px solid var(--border-subtle)",
                      borderLeft: isSelected ? "3px solid var(--brand-accent)" : "3px solid transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.12s",
                      boxShadow: isSelected ? "var(--shadow-sm)" : "none",
                      userSelect: "none",
                    }}
                  >
                    <Avatar
                      initials={email.initials}
                      color={email.color}
                      size={34}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 3,
                        }}
                      >
                        {email.unread && <Dot color="var(--brand-accent)" size={5} />}
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: email.unread ? 600 : 500,
                            color: isSelected ? "var(--brand-accent)" : "var(--text-primary)",
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {email.from}
                        </span>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                            color: "var(--text-muted)",
                            flexShrink: 0,
                          }}
                        >
                          {email.time}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleToggleStar(e, email.id)}
                          title={email.starred ? "Starred" : "Not starred"}
                          style={{
                            background: "none",
                            border: "none",
                            padding: "0 2px",
                            cursor: "pointer",
                            color: email.starred ? "var(--status-warning-text)" : "var(--text-muted)",
                            display: "flex",
                            alignItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <StarIcon size={12} />
                        </button>
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: email.unread ? 600 : 400,
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          marginBottom: 2,
                        }}
                      >
                        {email.subject}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {email.preview}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Pane: Reading & Replying View */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-inset)",
            overflowY: "auto",
            padding: "36px 48px",
          }}
        >
          {selectedEmail ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                maxWidth: 720,
                width: "100%",
                margin: "0 auto",
                animation: "fadeSlideIn 0.2s ease",
              }}
            >
              {/* Header */}
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 9px",
                    borderRadius: 6,
                    background: "var(--brand-accent-subtle)",
                    color: "var(--brand-accent)",
                    fontSize: 11.5,
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    marginBottom: 12,
                  }}
                >
                  <Dot color="var(--brand-accent)" size={5} />
                  <span>{selectedEmail.tag}</span>
                </div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.03em",
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {selectedEmail.subject}
                </h2>
              </div>

              {/* Message Body Card */}
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 12,
                  padding: "24px 28px",
                  boxShadow: "var(--shadow-sm)",
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  <Avatar
                    initials={selectedEmail.initials}
                    color={selectedEmail.color}
                    size={38}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {selectedEmail.from}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                        marginTop: 1,
                      }}
                    >
                      to me · {selectedEmail.time}
                    </div>
                  </div>
                </div>

                <EmailBodyContent
                  body={fullBodies[String(selectedEmail.id)]?.body || selectedEmail.body}
                  bodyHtml={fullBodies[String(selectedEmail.id)]?.bodyHtml || selectedEmail.bodyHtml}
                  preview={selectedEmail.preview}
                  isLoading={isSelectedBodyLoading}
                />
              </div>

              {/* Reply Composer */}
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 12,
                  padding: "16px 20px",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginBottom: 10,
                  }}
                >
                  Reply to {selectedEmail.from}
                </div>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a message or draft instructions…"
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    resize: "none",
                    fontSize: 13.5,
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    color: "var(--text-primary)",
                    lineHeight: 1.6,
                  }}
                />
                {replyError && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--status-error-text)",
                      background: "var(--status-error-bg)",
                      border: "1px solid var(--status-error-border)",
                      borderRadius: 6,
                      padding: "6px 10px",
                      marginTop: 8,
                    }}
                  >
                    {replyError}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        background: "transparent",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 7,
                        padding: "5px 11px",
                        cursor: "pointer",
                        transition: "all 0.12s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--bg-hover)";
                        e.currentTarget.style.color = "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }}
                    >
                      <ReplyIcon />
                      <span>Reply</span>
                    </button>
                    <button
                      type="button"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        background: "transparent",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 7,
                        padding: "5px 11px",
                        cursor: "pointer",
                        transition: "all 0.12s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--bg-hover)";
                        e.currentTarget.style.color = "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }}
                    >
                      <PaperclipIcon />
                      <span>Attach</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || isSendingReply}
                    style={{
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "var(--text-inverse)",
                      background: replyText.trim() && !isSendingReply ? "var(--brand-accent)" : "var(--border-subtle)",
                      border: "none",
                      borderRadius: 8,
                      padding: "7px 16px",
                      cursor: replyText.trim() && !isSendingReply ? "pointer" : "default",
                      transition: "opacity 0.12s, background 0.12s",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    onMouseEnter={(e) => {
                      if (replyText.trim() && !isSendingReply) e.currentTarget.style.opacity = "0.88";
                    }}
                    onMouseLeave={(e) => {
                      if (replyText.trim() && !isSendingReply) e.currentTarget.style.opacity = "1";
                    }}
                  >
                    {isSendingReply ? (
                      <>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{ animation: "spin 0.8s linear infinite" }}
                        >
                          <circle cx="8" cy="8" r="6" stroke="currentColor" opacity="0.4" strokeWidth="2.5" />
                          <path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                        <span>Sending…</span>
                      </>
                    ) : (
                      "Send"
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                textAlign: "center",
              }}
            >
              <InboxIcon size={36} />
              <p style={{ margin: "14px 0 0", fontSize: 14 }}>
                Select a thread from the list to view its contents
              </p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )}
</div>
);
}

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxInner />
    </Suspense>
  );
}
