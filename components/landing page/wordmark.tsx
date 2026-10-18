export function Mark() {
  return (
    <span
      className="grid size-7 place-items-center rounded-lg bg-ink text-[15px] font-semibold text-white"
      style={{ backgroundColor: "var(--landing-ink)", color: "var(--landing-bg-page)" }}
    >
      &gt;
    </span>
  );
}

export function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`flex items-center gap-2.5 font-semibold tracking-tight ${
        inverse ? "text-white" : "text-ink"
      }`}
      style={{ color: inverse ? "var(--on-accent)" : "var(--landing-ink)" }}
    >
      <Mark />
      Nexus
    </span>
  );
}
