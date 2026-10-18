"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarToggleIcon, BackIcon } from "@/components/dashboard/icons";
import { useGmailThreads } from "@/hooks/use-gmail";
import { log } from "@/lib/logger";

interface WaitlistEntry {
  id: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  source: string;
  note: string | null;
  createdAt: string;
  approvedAt: string | null;
  invitedAt: string | null;
}

interface Counts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export default function AdminWaitlistPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [resendConfigured, setResendConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const { threads } = useGmailThreads();
  const unreadCount = Array.isArray(threads)
    ? threads.filter((t) => t.unread || t.data?.unread).length
    : 0;

  const showNotification = useCallback((message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((current) => (current?.message === message ? null : current));
    }, 4000);
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/waitlist");
      if (res.status === 404) {
        router.push("/404");
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to fetch waitlist");
      }
      const data = await res.json();
      setEntries(data.entries || []);
      setCounts(data.counts || { total: 0, pending: 0, approved: 0, rejected: 0 });
      setResendConfigured(Boolean(data.resendConfigured));
    } catch (err) {
      log.error("[admin/waitlist] Failed to load waitlist", { error: err });
      showNotification("Failed to load waitlist entries.", "error");
    } finally {
      setLoading(false);
    }
  }, [router, showNotification]);

  useEffect(() => {
    let active = true;
    async function fetchInitial() {
      try {
        const res = await fetch("/api/admin/waitlist");
        if (!active) return;
        if (res.status === 404) {
          router.push("/404");
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to fetch waitlist");
        }
        const data = await res.json();
        if (!active) return;
        setEntries(data.entries || []);
        setCounts(data.counts || { total: 0, pending: 0, approved: 0, rejected: 0 });
        setResendConfigured(Boolean(data.resendConfigured));
      } catch (err) {
        if (!active) return;
        log.error("[admin/waitlist] Failed to load waitlist", { error: err });
        showNotification("Failed to load waitlist entries.", "error");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    fetchInitial();
    return () => {
      active = false;
    };
  }, [router, showNotification]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        entry.email.toLowerCase().includes(q) ||
        (entry.note && entry.note.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [entries, statusFilter, search]);

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredEntries.map((e) => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Status mutation (Approve, Reject, Revoke)
  const handleUpdateStatus = async (ids: string[], newStatus: "approved" | "rejected" | "pending") => {
    if (ids.length === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update status");
      }

      const data = await res.json();
      showNotification(
        `Updated ${data.updatedCount} entry to ${newStatus}.${
          data.invitesSent ? ` (${data.invitesSent} invite email(s) sent)` : ""
        }`
      );
      setSelectedIds(new Set());
      await loadEntries();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete mutation
  const handleDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${ids.length} waitlist entry?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete entries");
      }

      showNotification(`Deleted ${ids.length} waitlist entry.`);
      setSelectedIds(new Set());
      await loadEntries();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Send single invite email
  const handleSendInvite = async (entry: WaitlistEntry) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/waitlist/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send invite email");
      }

      showNotification(`Invite email sent to ${entry.email}.`);
      await loadEntries();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Copy approved emails to clipboard (comma-separated for Google Cloud Console)
  const handleCopyApprovedEmails = () => {
    const approved = entries
      .filter((e) => e.status === "approved")
      .map((e) => e.email.trim());

    if (approved.length === 0) {
      showNotification("No approved emails to copy.", "error");
      return;
    }

    const textToCopy = approved.join(", ");
    navigator.clipboard.writeText(textToCopy);
    showNotification(`Copied ${approved.length} approved email(s) for Google Cloud test users!`);
  };

  // Copy manual invite message for an approved entry
  const handleCopyInviteMessage = (entry: WaitlistEntry) => {
    const message = `Hi! Your early access to Nexus has been approved.

You can now create your account and sign in here:
${window.location.origin}/register

Note: During onboarding with Google, you may see an "unverified app" screen. Click "Advanced" and "Go to Nexus" to proceed.`;

    navigator.clipboard.writeText(message);
    showNotification(`Copied invite message for ${entry.email} to clipboard!`);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (entries.length === 0) {
      showNotification("No entries to export.", "error");
      return;
    }

    const headers = ["ID", "Email", "Status", "Source", "Note", "Created At", "Approved At", "Invited At"];
    const rows = entries.map((e) => [
      `"${e.id}"`,
      `"${e.email}"`,
      `"${e.status}"`,
      `"${e.source}"`,
      `"${(e.note || "").replace(/"/g, '""')}"`,
      `"${e.createdAt}"`,
      `"${e.approvedAt || ""}"`,
      `"${e.invitedAt || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nexus-waitlist-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("Exported waitlist to CSV.");
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100%",
        background: "var(--bg-page)",
        fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
        overflow: "hidden",
      }}
    >
      {/* ── Sidebar ── */}
      <Sidebar
        activeNav="admin-waitlist"
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onSelectNav={(nav) => {
          if (nav === "inbox") {
            router.push("/dashboard/inbox");
          } else if (nav === "today" || nav === "upcoming") {
            router.push("/dashboard/calendar");
          } else if (nav === "account") {
            router.push("/dashboard/account");
          } else {
            router.push("/dashboard");
          }
        }}
        onOpenCalendar={() => router.push("/dashboard/calendar")}
        onGoBack={() => router.push("/dashboard")}
        inboxBadge={unreadCount}
      />

      {/* ── Main Content Area ── */}
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
              title={sidebarCollapsed ? "Open sidebar" : "Collapse sidebar"}
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
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <BackIcon size={12} />
              <span>Dashboard</span>
            </button>

            <span style={{ color: "var(--border-strong)", fontSize: 13 }}>/</span>

            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              Waitlist & Access Approval
            </span>
          </div>

          {/* Refresh button */}
          <button
            onClick={loadEntries}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 7,
              border: "1px solid var(--border-hairline)",
              background: "var(--surface-card)",
              color: "var(--text-secondary)",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-card)")}
          >
            <span>↻</span>
            <span>Refresh</span>
          </button>
        </header>

        {/* Scrollable Container */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 32px 60px",
            background: "var(--bg-page)",
          }}
        >
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Notification Banner */}
            {notification && (
              <div
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: notification.type === "success" ? "var(--success-tint)" : "var(--danger-tint)",
                  color: notification.type === "success" ? "var(--success)" : "var(--danger)",
                  border: `1px solid ${
                    notification.type === "success" ? "var(--success-border)" : "var(--danger-border)"
                  }`,
                }}
              >
                <span>{notification.message}</span>
                <button
                  onClick={() => setNotification(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Mandatory Reminder Banner */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "16px 20px",
                borderRadius: 12,
                background: "var(--warning-tint)",
                border: "1px solid var(--warning-border)",
                color: "var(--warning)",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong style={{ display: "block", marginBottom: 2 }}>Required Google OAuth Setup</strong>
                After approving, add the email as a Test user in Google Cloud Console, or Gmail connect will be blocked.
              </div>
            </div>

            {/* Stat Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 14,
              }}
            >
              <div
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: 12,
                  padding: "16px 20px",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Total Requests</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>
                  {counts.total}
                </div>
              </div>

              <div
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: 12,
                  padding: "16px 20px",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--warning)", fontWeight: 500 }}>Pending Review</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "var(--warning)", marginTop: 4 }}>
                  {counts.pending}
                </div>
              </div>

              <div
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: 12,
                  padding: "16px 20px",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 500 }}>Approved Users</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "var(--success)", marginTop: 4 }}>
                  {counts.approved}
                </div>
              </div>

              <div
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: 12,
                  padding: "16px 20px",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--danger)", fontWeight: 500 }}>Rejected Requests</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "var(--danger)", marginTop: 4 }}>
                  {counts.rejected}
                </div>
              </div>
            </div>

            {/* Filter Tabs & Toolbar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                background: "var(--surface-card)",
                padding: "14px 18px",
                borderRadius: 12,
                border: "1px solid var(--border-hairline)",
              }}
            >
              {/* Status Tabs */}
              <div style={{ display: "flex", gap: 6 }}>
                {(["all", "pending", "approved", "rejected"] as const).map((tab) => {
                  const isActive = statusFilter === tab;
                  const label = tab.charAt(0).toUpperCase() + tab.slice(1);
                  const count =
                    tab === "all"
                      ? counts.total
                      : tab === "pending"
                      ? counts.pending
                      : tab === "approved"
                      ? counts.approved
                      : counts.rejected;

                  return (
                    <button
                      key={tab}
                      onClick={() => setStatusFilter(tab)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 7,
                        border: "none",
                        fontSize: 12.5,
                        fontWeight: isActive ? 600 : 500,
                        cursor: "pointer",
                        background: isActive ? "var(--accent-tint)" : "transparent",
                        color: isActive ? "var(--accent-text)" : "var(--text-secondary)",
                        transition: "all 0.12s",
                      }}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Search & Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Search by email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 7,
                    border: "1px solid var(--border-hairline)",
                    background: "var(--bg-workspace)",
                    color: "var(--text-primary)",
                    fontSize: 12.5,
                    outline: "none",
                    width: 200,
                  }}
                />

                {/* Bulk Actions */}
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => handleUpdateStatus(Array.from(selectedIds), "approved")}
                    disabled={actionLoading}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 7,
                      border: "none",
                      background: "var(--success)",
                      color: "var(--on-accent)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Approve selected ({selectedIds.size})
                  </button>
                )}

                {/* Copy Approved Emails */}
                <button
                  onClick={handleCopyApprovedEmails}
                  title="Copy comma-separated list of approved emails for Google Cloud Console"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 7,
                    border: "1px solid var(--border-hairline)",
                    background: "var(--bg-workspace)",
                    color: "var(--text-primary)",
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <span>📋</span>
                  <span>Copy approved emails</span>
                </button>

                {/* Export CSV */}
                <button
                  onClick={handleExportCSV}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 7,
                    border: "1px solid var(--border-hairline)",
                    background: "var(--bg-workspace)",
                    color: "var(--text-primary)",
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <span>📥</span>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div
              style={{
                background: "var(--surface-card)",
                borderRadius: 14,
                border: "1px solid var(--border-hairline)",
                overflow: "hidden",
                boxShadow: "0 1px 3px var(--shadow-color)",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border-hairline)",
                      background: "var(--surface-raised)",
                      color: "var(--text-secondary)",
                      fontSize: 11.5,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <th style={{ padding: "12px 16px", width: 40 }}>
                      <input
                        type="checkbox"
                        checked={
                          filteredEntries.length > 0 &&
                          filteredEntries.every((e) => selectedIds.has(e.id))
                        }
                        onChange={handleSelectAll}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                    <th style={{ padding: "12px 16px" }}>Email</th>
                    <th style={{ padding: "12px 16px" }}>Signup Date</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                        Loading waitlist entries...
                      </td>
                    </tr>
                  ) : filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                        {search ? "No entries match your search." : "No entries in this view."}
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((entry) => {
                      const isSelected = selectedIds.has(entry.id);
                      const formattedDate = new Date(entry.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      });

                      return (
                        <tr
                          key={entry.id}
                          style={{
                            borderBottom: "1px solid var(--border-hairline)",
                            background: isSelected ? "var(--hover-subtle)" : "transparent",
                            transition: "background 0.1s",
                          }}
                        >
                          {/* Checkbox */}
                          <td style={{ padding: "14px 16px" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(entry.id)}
                              style={{ cursor: "pointer" }}
                            />
                          </td>

                          {/* Email */}
                          <td style={{ padding: "14px 16px", color: "var(--text-primary)", fontWeight: 500 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span>{entry.email}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(entry.email);
                                  showNotification(`Copied ${entry.email}`);
                                }}
                                title="Copy email address"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--text-muted)",
                                  fontSize: 11,
                                }}
                              >
                                📋
                              </button>
                            </div>
                            {entry.note && (
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                {entry.note}
                              </div>
                            )}
                          </td>

                          {/* Date */}
                          <td style={{ padding: "14px 16px", color: "var(--text-secondary)", fontSize: 12 }}>
                            {formattedDate}
                          </td>

                          {/* Status */}
                          <td style={{ padding: "14px 16px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 10px",
                                borderRadius: 20,
                                fontSize: 11.5,
                                fontWeight: 600,
                                textTransform: "capitalize",
                                background:
                                  entry.status === "approved"
                                    ? "var(--success-tint)"
                                    : entry.status === "rejected"
                                    ? "var(--danger-tint)"
                                    : "var(--warning-tint)",
                                color:
                                  entry.status === "approved"
                                    ? "var(--success)"
                                    : entry.status === "rejected"
                                    ? "var(--danger)"
                                    : "var(--warning)",
                                border: `1px solid ${
                                  entry.status === "approved"
                                    ? "var(--success-border)"
                                    : entry.status === "rejected"
                                    ? "var(--danger-border)"
                                    : "var(--warning-border)"
                                }`,
                              }}
                            >
                              {entry.status}
                            </span>
                            {entry.invitedAt && (
                              <span
                                title={`Invite sent at ${entry.invitedAt}`}
                                style={{
                                  display: "inline-block",
                                  marginLeft: 6,
                                  fontSize: 10,
                                  color: "var(--text-muted)",
                                }}
                              >
                                ✉️ Sent
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {/* Pending -> Approve & Reject */}
                              {entry.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => handleUpdateStatus([entry.id], "approved")}
                                    disabled={actionLoading}
                                    style={{
                                      padding: "4px 9px",
                                      borderRadius: 6,
                                      border: "none",
                                      background: "var(--success)",
                                      color: "var(--on-accent)",
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus([entry.id], "rejected")}
                                    disabled={actionLoading}
                                    style={{
                                      padding: "4px 9px",
                                      borderRadius: 6,
                                      border: "1px solid var(--danger-border)",
                                      background: "transparent",
                                      color: "var(--danger)",
                                      fontSize: 11.5,
                                      fontWeight: 500,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {/* Approved -> Revoke & Invite */}
                              {entry.status === "approved" && (
                                <>
                                  <button
                                    onClick={() => handleUpdateStatus([entry.id], "pending")}
                                    disabled={actionLoading}
                                    title="Revoke access (resets to pending and invalidates existing sessions)"
                                    style={{
                                      padding: "4px 9px",
                                      borderRadius: 6,
                                      border: "1px solid var(--border-hairline)",
                                      background: "transparent",
                                      color: "var(--warning)",
                                      fontSize: 11.5,
                                      fontWeight: 500,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Revoke
                                  </button>

                                  {resendConfigured ? (
                                    <button
                                      onClick={() => handleSendInvite(entry)}
                                      disabled={actionLoading}
                                      style={{
                                        padding: "4px 9px",
                                        borderRadius: 6,
                                        border: "none",
                                        background: "var(--accent-solid)",
                                        color: "var(--on-accent)",
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      {entry.invitedAt ? "Resend invite" : "Send invite"}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleCopyInviteMessage(entry)}
                                      title="Copy personalized invite message to clipboard"
                                      style={{
                                        padding: "4px 9px",
                                        borderRadius: 6,
                                        border: "1px solid var(--border-hairline)",
                                        background: "var(--bg-workspace)",
                                        color: "var(--text-secondary)",
                                        fontSize: 11.5,
                                        fontWeight: 500,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Copy message
                                    </button>
                                  )}
                                </>
                              )}

                              {/* Rejected -> Approve */}
                              {entry.status === "rejected" && (
                                <button
                                  onClick={() => handleUpdateStatus([entry.id], "approved")}
                                  disabled={actionLoading}
                                  style={{
                                    padding: "4px 9px",
                                    borderRadius: 6,
                                    border: "none",
                                    background: "var(--success)",
                                    color: "var(--on-accent)",
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Approve
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={() => handleDelete([entry.id])}
                                disabled={actionLoading}
                                title="Delete entry"
                                style={{
                                  padding: "4px 7px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: "transparent",
                                  color: "var(--text-muted)",
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                              >
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
