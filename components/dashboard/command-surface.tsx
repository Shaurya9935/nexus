"use client";

import React, { useRef, useEffect, useState } from "react";
import { CommandIcon, MicIcon, ArrowUpIcon } from "./icons";

export interface CommandSurfaceProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export function CommandSurface({
  value,
  onChange,
  onSubmit,
  placeholder = "What's on your mind?",
  className = "",
  disabled = false,
  loading = false,
}: CommandSurfaceProps) {
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  // Global ⌘K / Ctrl+K listener to focus command surface
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = () => {
    if (value.trim() && onSubmit) {
      onSubmit(value.trim());
    }
  };

  return (
    <div
      data-tour="command-bar"
      className={className}
      style={{
        borderRadius: 14,
        border: focused
          ? "1.5px solid var(--accent-solid)"
          : "1.5px solid var(--border-hairline)",
        background: "var(--surface-card)",
        boxShadow: focused
          ? "0 0 0 1px var(--focus-ring), 0 4px 16px var(--shadow-color)"
          : "0 2px 8px var(--shadow-color)",
        transition: "border-color 0.18s, box-shadow 0.18s",
        marginBottom: 16,
      }}
    >
      {/* Input row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "18px 18px 10px",
        }}
      >
        <div
          style={{
            color: focused ? "var(--accent-text)" : "var(--text-disabled)",
            paddingTop: 3,
            transition: "color 0.18s",
            flexShrink: 0,
            display: "flex",
          }}
        >
          <CommandIcon />
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled || loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={loading ? "Nexus AI is processing…" : placeholder}
          rows={1}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            outline: "none",
            resize: "none",
            fontSize: 15,
            fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            color: "var(--text-primary)",
            lineHeight: 1.55,
            minHeight: 24,
            maxHeight: 140,
            overflowY: "auto",
            opacity: disabled || loading ? 0.7 : 1,
          }}
        />
      </div>

      {/* Action bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 18px 14px",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            color: "var(--text-disabled)",
            letterSpacing: "0.01em",
          }}
        >
          ⌘ K
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <button
            type="button"
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              border: "1px solid var(--border-hairline)",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--hover)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <MicIcon />
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim() || disabled || loading}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: value.trim() || loading ? "none" : "1px solid var(--border-hairline)",
              background: loading
                ? "var(--accent-solid)"
                : value.trim()
                ? "var(--accent-solid)"
                : "var(--surface-raised)",
              cursor: value.trim() && !disabled && !loading ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: value.trim() || loading ? "var(--on-accent)" : "var(--text-muted)",
              transition: "background 0.15s, color 0.15s, border-color 0.15s",
            }}
          >
            {loading ? (
              <svg
                width={14}
                height={14}
                viewBox="0 0 16 16"
                fill="none"
                style={{ animation: "spin 1s linear infinite" }}
              >
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="16" />
              </svg>
            ) : (
              <ArrowUpIcon />
            )}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
