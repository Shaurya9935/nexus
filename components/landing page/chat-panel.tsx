"use client";

import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

export function ChatPanel({ active = false }: { active?: boolean }) {
  return (
    <motion.div
      className="chat-panel"
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0.92, y: 6 }}
      transition={{ duration: 0.45, ease }}
    >
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <span className="size-2 rounded-full bg-[var(--status-success-text)]" />
        <span className="text-[9px] font-semibold text-ink">Nexus assistant</span>
      </div>
      <div className="p-3">
        {active && (
          <p className="mb-2 ml-auto max-w-[90%] rounded-xl rounded-br-sm bg-accent px-3 py-2 text-[9px] leading-relaxed text-white">
            Reply to Priya, I’m free at 4 PM, and add it to my calendar.
          </p>
        )}
        <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[9px] text-muted">
          <span>
            {active ? "Ready for your approval" : "Ask Nexus anything…"}
          </span>
          <span className="grid size-5 place-items-center rounded-md bg-accent text-white">
            ↑
          </span>
        </div>
      </div>
    </motion.div>
  );
}
