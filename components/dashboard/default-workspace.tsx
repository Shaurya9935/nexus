"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { log } from "@/lib/logger";
import { Email, FocusItem, UserProfile, View } from "./types";
import { Dot } from "./dot";
import { CommandSurface } from "./command-surface";
import { Suggestions } from "./suggestions";
import { FocusSection } from "./focus-section";
import { NeedsAttention } from "./needs-attention";
import { CURRENT_USER } from "./mock-data";

export interface DefaultWorkspaceProps {
  onSelectEmail: (email: Email) => void;
  onSelectCalendar: () => void;
  onSelectInbox?: () => void;
  user?: UserProfile;
  focusItems?: FocusItem[];
  emails?: Email[];
  isLoading?: boolean;
  activeConversationId?: string | null;
  onActiveConversationChange?: (id: string | null) => void;
  isGmailConnected?: boolean;
  onConnectGmail?: () => void;
}

import type { PendingActionPreview } from "@/lib/ai/agent";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  pendingActions?: PendingActionPreview[];
  confirmationStatus?: "pending" | "confirmed" | "cancelled";
}

function renderFormattedMessage(text: string, isUser: boolean) {
  if (isUser) {
    return text;
  }

  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    // Markdown headings e.g. ### Header or ## Header
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      return (
        <div
          key={lineIdx}
          style={{
            fontWeight: 700,
            color: "var(--text-primary)",
            marginTop: lineIdx > 0 ? 10 : 0,
            marginBottom: 4,
            fontSize: headingMatch[1].length <= 2 ? "1.1em" : "1.02em",
          }}
        >
          {headingMatch[2]}
        </div>
      );
    }

    // Bullets e.g. - or * or • or 1.
    const bulletMatch = line.match(/^(\s*)([-*•]|\d+\.)\s+(.+)$/);
    const content = bulletMatch ? bulletMatch[3] : line;

    // Parse **bold** and `code`
    const parts = content.split(/(\*\*.*?\*\*|`.*?`)/g);
    const formattedLine = parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={pIdx} style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={pIdx}
            style={{
              background: "var(--code-bg)",
              padding: "1px 5px",
              borderRadius: 4,
              fontSize: "0.9em",
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });

    if (bulletMatch) {
      const isNumbered = /^\d+\./.test(bulletMatch[2]);
      return (
        <div
          key={lineIdx}
          style={{
            display: "flex",
            gap: 8,
            marginTop: 4,
            marginBottom: 4,
            paddingLeft: bulletMatch[1].length * 4,
          }}
        >
          <span style={{ color: "var(--accent-text)", flexShrink: 0, fontWeight: 500 }}>
            {isNumbered ? bulletMatch[2] : "•"}
          </span>
          <span style={{ flex: 1 }}>{formattedLine}</span>
        </div>
      );
    }

    return (
      <div key={lineIdx} style={{ minHeight: line.trim() === "" ? 8 : undefined }}>
        {formattedLine}
      </div>
    );
  });
}

export function DefaultWorkspace({
  onSelectEmail,
  onSelectCalendar,
  onSelectInbox,
  user = CURRENT_USER,
  focusItems,
  emails = [],
  isLoading = false,
  activeConversationId = null,
  onActiveConversationChange,
  isGmailConnected,
  onConnectGmail,
}: DefaultWorkspaceProps) {
  const [commandInput, setCommandInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleTriggerFocusAction = (action: View) => {
    if (action === "email") {
      if (onSelectInbox) {
        onSelectInbox();
      } else if (emails.length > 0) {
        onSelectEmail(emails[0]);
      }
    } else if (action === "calendar") {
      onSelectCalendar();
    } else if (action === "command") {
      setCommandInput("What should I focus on next?");
    }
  };

  const attentionEmails = useMemo(() => {
    if (!emails || emails.length === 0) return [];
    const urgent = emails.filter((e) => e.unread || e.tag === "Needs reply");
    return urgent.length > 0 ? urgent.slice(0, 5) : emails.slice(0, 4);
  }, [emails]);

  const firstName = user.name.split(" ")[0];

  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const [prevActiveConversationId, setPrevActiveConversationId] = useState(activeConversationId);
  if (activeConversationId !== prevActiveConversationId) {
    setPrevActiveConversationId(activeConversationId);
    if (!activeConversationId) {
      setMessages([]);
    }
  }

  // Load conversation when activeConversationId changes
  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    let cancelled = false;

    async function loadHistory() {
      try {
        const response = await fetch(`/api/conversations/${activeConversationId}`);

        if (!response.ok) {
          if (response.status === 404 && onActiveConversationChange) {
            onActiveConversationChange(null);
          }
          return;
        }

        const data = (await response.json()) as {
          id: string;
          messages: Array<{
            id: string;
            role: "user" | "assistant";
            content: string;
            createdAt: string;
          }>;
        };

        if (cancelled) return;

        setMessages(
          data.messages.map((message) => ({
            id: message.id,
            role: message.role,
            text: message.content,
            timestamp: new Date(message.createdAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            }),
          })),
        );
      } catch (error) {
        log.error("Failed to load chat history", { error });
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId, onActiveConversationChange]);

  const [approvingTokens, setApprovingTokens] = useState<Record<string, boolean>>({});

  const handleDecision = async (
    messageId: string,
    tokens: string[],
    decision: "approve" | "deny"
  ) => {
    const tokenKeys = tokens.reduce((acc, t) => ({ ...acc, [t]: true }), {});
    setApprovingTokens((prev) => ({ ...prev, ...tokenKeys }));

    try {
      for (const token of tokens) {
        const res = await fetch("/api/ai/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, decision }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          log.error("Failed to process approval token", { decision, token, errData });
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                confirmationStatus: decision === "approve" ? "confirmed" : "cancelled",
              }
            : m
        )
      );
    } catch (err) {
      log.error("Error processing approval decision", { error: err });
    } finally {
      setApprovingTokens((prev) => {
        const next = { ...prev };
        for (const t of tokens) delete next[t];
        return next;
      });
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userText = text.trim();

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setCommandInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userText,
          conversationId: activeConversationId,
        }),
      });

      const data = await res.json();

      let reply = "";
      let action: { label: string; onClick: () => void } | undefined = undefined;

      if (!res.ok) {
        if (res.status === 401) {
          reply = "You need to be logged in to use the Nexus AI assistant. Please log in and try again.";
        } else {
          reply = data.error || "Sorry, I ran into an issue processing your request. Please try again.";
        }
      } else {
        if (typeof data.conversationId === "string" && data.conversationId !== activeConversationId) {
          if (onActiveConversationChange) {
            onActiveConversationChange(data.conversationId);
          }
        }

        reply =
          typeof data.response === "string"
            ? data.response
            : typeof data.response?.text === "string"
            ? data.response.text
            : JSON.stringify(data.response, null, 2);

        // Intelligently infer quick action buttons based on content or user request
        const lowerReply = (reply || "").toLowerCase();
        const lower = userText.toLowerCase();

        if (
          lowerReply.includes("calendar") ||
          lowerReply.includes("meeting") ||
          lowerReply.includes("schedule") ||
          lowerReply.includes("event") ||
          lower.includes("calendar") ||
          lower.includes("meeting") ||
          lower.includes("schedule")
        ) {
          if (onSelectCalendar) {
            action = {
              label: "View Calendar →",
              onClick: onSelectCalendar,
            };
          }
        } else if (
          lowerReply.includes("email") ||
          lowerReply.includes("unread") ||
          lowerReply.includes("inbox") ||
          lowerReply.includes("thread") ||
          lower.includes("email") ||
          lower.includes("unread") ||
          lower.includes("inbox")
        ) {
          if (onSelectInbox) {
            action = {
              label: "Open Full Inbox →",
              onClick: onSelectInbox,
            };
          } else if (emails.length > 0 && onSelectEmail) {
            action = {
              label: "Open Thread →",
              onClick: () => onSelectEmail(emails[0]),
            };
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        text: reply || "I couldn't generate a response. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        action,
        pendingActions:
          Array.isArray(data.pendingActions) && data.pendingActions.length > 0
            ? data.pendingActions
            : undefined,
        confirmationStatus:
          Array.isArray(data.pendingActions) && data.pendingActions.length > 0
            ? "pending"
            : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      log.error("Failed to send message to /api/ai", { error: err });
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        text: "Failed to connect to the assistant. Please check your connection and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ── Top Context Header ── */}
      <div
        style={{
          padding: "20px 48px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border-hairline)",
          background: "var(--bg-workspace)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              color: "var(--text-muted)",
              letterSpacing: "0.01em",
            }}
          >
            {dateStr}
          </div>
          <div style={{ width: 1, height: 12, background: "var(--border-hairline)" }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              color: "var(--status-connected)",
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            }}
          >
            <Dot color="var(--status-connected)" size={6} />
            <span>AI Assistant Active</span>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={async () => {
              if (activeConversationId) {
                try {
                  await fetch(`/api/conversations/${activeConversationId}/clear`, {
                    method: "POST",
                  });
                } catch (e) {
                  log.error("Failed to clear chat", { error: e });
                }
              }
              setMessages([]);
            }}
            style={{
              background: "none",
              border: "none",
              fontSize: 12,
              color: "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
              padding: "4px 8px",
              borderRadius: 6,
              transition: "color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent-text)";
              e.currentTarget.style.background = "var(--hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "none";
            }}
          >
            Clear chat
          </button>
        )}
      </div>

      {/* ── Chat & Command Container ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 48px 24px",
          display: "flex",
          flexDirection: "column",
          maxWidth: 780,
          width: "100%",
          margin: "0 auto",
        }}
      >
        {messages.length === 0 ? (
          /* Initial Welcome State */
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              paddingTop: 8,
              paddingBottom: 48,
              animation: "fadeSlideIn 0.25s ease",
            }}
          >
            <div style={{ marginBottom: 28 }}>
              <h1
                style={{
                  fontSize: 26,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.03em",
                  margin: 0,
                  lineHeight: 1.25,
                  fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
                }}
              >
                Good {timeOfDay}, {firstName}.
              </h1>
              <p
                style={{
                  fontSize: 14.5,
                  color: "var(--text-secondary)",
                  margin: "8px 0 0",
                  fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                  fontWeight: 400,
                }}
              >
                What would you like to take care of in your inbox or schedule?
              </p>
            </div>

            {/* Main Command Input Box */}
            <CommandSurface
              value={commandInput}
              onChange={setCommandInput}
              onSubmit={handleSendMessage}
              loading={isTyping}
              placeholder="Ask anything about your emails, draft replies, or schedule..."
            />

            {/* Prompt Suggestions */}
            <div data-tour="assistant" style={{ marginTop: 24, marginBottom: 36 }}>
              <div
                style={{
                  fontSize: 11.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                  marginBottom: 10,
                }}
              >
                Suggested prompts
              </div>
              <Suggestions onSelectSuggestion={handleSelectSuggestion} />
            </div>

            {/* Focus Section */}
            <FocusSection
              items={focusItems}
              onTriggerAction={handleTriggerFocusAction}
            />

            {/* Needs Attention */}
            <NeedsAttention
              emails={attentionEmails}
              isLoading={isLoading}
              onSelectEmail={onSelectEmail}
              onViewInbox={onSelectInbox || (() => {})}
              isGmailConnected={isGmailConnected}
              onConnectGmail={onConnectGmail}
            />
          </div>
        ) : (
          /* Active Chat Conversation Feed */
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              paddingBottom: 24,
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    color: "var(--text-muted)",
                    padding: "0 4px",
                  }}
                >
                  <span>{msg.role === "user" ? firstName : "Assistant"}</span>
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  style={{
                    maxWidth: "88%",
                    padding: "16px 20px",
                    borderRadius: 14,
                    background: msg.role === "user" ? "var(--accent-solid)" : "var(--surface-card)",
                    color: msg.role === "user" ? "var(--on-accent)" : "var(--text-primary)",
                    fontSize: 14,
                    lineHeight: 1.6,
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    boxShadow:
                      msg.role === "user"
                        ? "0 2px 10px var(--shadow-color)"
                        : "0 2px 10px var(--shadow-color)",
                    border: msg.role === "user" ? "none" : "1px solid var(--border-hairline)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {renderFormattedMessage(msg.text, msg.role === "user")}

                  {/* ── Pending Confirmation Card ── */}
                  {msg.pendingActions && msg.pendingActions.length > 0 && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: "14px 16px",
                        borderRadius: 10,
                        background: "var(--surface-raised)",
                        border: "1px solid var(--border-hairline)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      {msg.pendingActions.map((action, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            paddingBottom: idx < msg.pendingActions!.length - 1 ? 12 : 0,
                            borderBottom:
                              idx < msg.pendingActions!.length - 1 ? "1px dashed var(--border-dashed)" : "none",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                              color: action.type === "send_email" ? "var(--accent-text)" : "var(--success)",
                            }}
                          >
                            <span>
                              {action.type === "send_email"
                                ? "✉ Email Preview"
                                : "📅 Calendar Event Preview"}
                            </span>
                          </div>

                          {action.type === "send_email" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                              <div>
                                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>To: </span>
                                <span
                                  style={{
                                    fontFamily: "var(--font-mono, monospace)",
                                    color: "var(--text-primary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  {action.to}
                                </span>
                              </div>
                              {action.subject && (
                                <div>
                                  <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Subject: </span>
                                  <span style={{ color: "var(--text-primary)" }}>{action.subject}</span>
                                </div>
                              )}
                              {action.body && (
                                <div
                                  style={{
                                    marginTop: 4,
                                    padding: "8px 12px",
                                    background: "var(--surface-card)",
                                    border: "1px solid var(--border-hairline)",
                                    borderLeft: "3px solid var(--accent-solid)",
                                    borderRadius: 6,
                                    color: "var(--text-primary)",
                                    whiteSpace: "pre-wrap",
                                    fontSize: 12.5,
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {action.body}
                                </div>
                              )}
                            </div>
                          )}

                          {action.type === "create_calendar_event" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                              <div>
                                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Title: </span>
                                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{action.title}</span>
                              </div>
                              <div>
                                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Time: </span>
                                <span style={{ color: "var(--text-primary)" }}>
                                  {new Date(action.startISO || "").toLocaleString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })}
                                  {action.endISO && (
                                    <>
                                      {" – "}
                                      {new Date(action.endISO).toLocaleTimeString("en-IN", {
                                        timeZone: "Asia/Kolkata",
                                        timeStyle: "short",
                                      })}
                                    </>
                                  )}{" "}
                                  (IST)
                                </span>
                              </div>
                              {action.attendeeEmails && action.attendeeEmails.length > 0 && (
                                <div>
                                  <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Attendees: </span>
                                  <span
                                    style={{
                                      fontFamily: "var(--font-mono, monospace)",
                                      color: "var(--text-primary)",
                                      fontSize: 12,
                                    }}
                                  >
                                    {action.attendeeEmails.join(", ")}
                                  </span>
                                </div>
                              )}
                              {action.location && (
                                <div>
                                  <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Location: </span>
                                  <span style={{ color: "var(--text-primary)" }}>{action.location}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {action.type === "delete_calendar_event" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                              <div>
                                <span style={{ color: "var(--danger)", fontWeight: 600 }}>Action: </span>
                                <span style={{ color: "var(--danger)", fontWeight: 500 }}>Delete Calendar Event</span>
                              </div>
                              <div>
                                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Event: </span>
                                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{action.title || "Calendar Event"}</span>
                              </div>
                              {action.startISO && (
                                <div>
                                  <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Time: </span>
                                  <span style={{ color: "var(--text-primary)" }}>
                                    {new Date(action.startISO || "").toLocaleString("en-IN", {
                                      timeZone: "Asia/Kolkata",
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })}
                                    {action.endISO && (
                                      <>
                                        {" – "}
                                        {new Date(action.endISO).toLocaleTimeString("en-IN", {
                                          timeZone: "Asia/Kolkata",
                                          timeStyle: "short",
                                        })}
                                      </>
                                    )}{" "}
                                    (IST)
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Confirmation Action Buttons */}
                      <div
                        style={{
                          marginTop: 6,
                          paddingTop: 10,
                          borderTop: "1px solid var(--border-hairline)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        {(() => {
                          const tokens = (msg.pendingActions || []).map((p) => p.token).filter(Boolean);
                          const isOperating = tokens.some((t) => approvingTokens[t]);

                          if (msg.confirmationStatus === "pending") {
                            return (
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <button
                                  type="button"
                                  disabled={isOperating || isTyping}
                                  onClick={() => handleDecision(msg.id, tokens, "approve")}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    background: "var(--accent-solid)",
                                    color: "var(--on-accent)",
                                    border: "none",
                                    borderRadius: 8,
                                    padding: "7px 16px",
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    cursor: isOperating || isTyping ? "not-allowed" : "pointer",
                                    transition: "opacity 0.15s",
                                    opacity: isOperating || isTyping ? 0.6 : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isOperating && !isTyping) e.currentTarget.style.opacity = "0.9";
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isOperating && !isTyping) e.currentTarget.style.opacity = "1";
                                  }}
                                >
                                  {isOperating ? "Processing…" : "✓ Approve"}
                                </button>
                                <button
                                  type="button"
                                  disabled={isOperating || isTyping}
                                  onClick={() => handleDecision(msg.id, tokens, "deny")}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    background: "var(--surface-card)",
                                    color: "var(--text-secondary)",
                                    border: "1px solid var(--border-strong)",
                                    borderRadius: 8,
                                    padding: "7px 14px",
                                    fontSize: 12.5,
                                    fontWeight: 500,
                                    cursor: isOperating || isTyping ? "not-allowed" : "pointer",
                                    transition: "background 0.15s",
                                    opacity: isOperating || isTyping ? 0.6 : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isOperating && !isTyping) e.currentTarget.style.background = "var(--hover)";
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isOperating && !isTyping) e.currentTarget.style.background = "var(--surface-card)";
                                  }}
                                >
                                  Reject
                                </button>
                              </div>
                            );
                          }

                          if (msg.confirmationStatus === "confirmed") {
                            return (
                              <div
                                style={{
                                  fontSize: 12,
                                  fontFamily: "var(--font-mono, monospace)",
                                  color: "var(--success)",
                                  background: "var(--success-tint)",
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  fontWeight: 500,
                                }}
                              >
                                ✓ Approved & Executed
                              </div>
                            );
                          }

                          return (
                            <div
                              style={{
                                fontSize: 12,
                                fontFamily: "var(--font-mono, monospace)",
                                color: "var(--danger)",
                                background: "var(--danger-tint)",
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontWeight: 500,
                              }}
                            >
                              ✕ Rejected
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {msg.action && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-hairline)" }}>
                      <button
                        type="button"
                        onClick={msg.action.onClick}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "var(--accent-solid)",
                          color: "var(--on-accent)",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 14px",
                          fontSize: 12.5,
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        {msg.action.label}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 18px",
                  borderRadius: 12,
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-hairline)",
                  width: "fit-content",
                  color: "var(--text-muted)",
                  fontSize: 12.5,
                  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                }}
              >
                <Dot color="var(--accent-solid)" size={6} />
                <span>Nexus AI is thinking…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Floating Input when chat has active messages */}
        {messages.length > 0 && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              background: "var(--bg-workspace)",
              paddingTop: 12,
              paddingBottom: 8,
            }}
          >
            <CommandSurface
              value={commandInput}
              onChange={setCommandInput}
              onSubmit={handleSendMessage}
              loading={isTyping}
              placeholder="Reply or ask follow-up..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
