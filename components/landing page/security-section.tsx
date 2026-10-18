import { ApprovalCard } from "./approval-card";

export function SecurityBand() {
  const points = [
    "You approve every send and every change.",
    "Your data is stored in your own database.",
    "Minimal permissions, read-only by default.",
    "Secure OAuth. We never see your password.",
  ];
  return (
    <section
      id="security"
      className="mx-3 my-28 overflow-hidden rounded-[28px] bg-dark text-white md:mx-5"
      style={{ backgroundColor: "var(--landing-dark)", color: "var(--on-accent)" }}
    >
      <div className="mx-auto grid max-w-[1200px] gap-16 px-6 py-20 md:grid-cols-[1.2fr_.8fr] md:px-12 md:py-28">
        <div>
          <p className="mono-kicker text-white/45">SECURITY BY DESIGN</p>
          <h2 className="mt-5 max-w-xl text-4xl font-semibold tracking-[-0.045em] md:text-5xl">
            Your work stays yours. Your approval stays essential.
          </h2>
          <div className="mt-12 grid sm:grid-cols-2">
            {points.map((point, i) => (
              <div
                key={point}
                className={`border-white/10 py-5 text-[15px] leading-relaxed text-white/65 ${
                  i > 1 ? "border-t" : ""
                } ${i % 2 ? "sm:border-l sm:pl-6" : "sm:pr-6"}`}
              >
                <span className="mb-3 block font-mono text-[10px] text-[var(--accent-text)]">
                  0{i + 1}
                </span>
                {point}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div
            className="w-full max-w-sm rounded-[20px] bg-white p-2 text-ink shadow-2xl shadow-black/30"
            style={{ backgroundColor: "var(--landing-surface-card)", color: "var(--landing-ink)" }}
          >
            <ApprovalCard compact />
          </div>
        </div>
      </div>
    </section>
  );
}
