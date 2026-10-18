"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { GithubIcon } from "./icons";
import type { SignalPath } from "./types";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const entered = useInView(heroRef, { amount: 0.2, once: true });
  const heroInView = useInView(heroRef, { amount: 0.1 });
  const reducedMotion = useReducedMotion();
  const [spotlightEnabled, setSpotlightEnabled] = useState(false);
  const pointerX = useMotionValue(-400);
  const pointerY = useMotionValue(-400);
  const spotlightX = useSpring(pointerX, { stiffness: 120, damping: 24 });
  const spotlightY = useSpring(pointerY, { stiffness: 120, damping: 24 });

  useEffect(() => {
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setSpotlightEnabled(pointerQuery.matches);
    update();
    pointerQuery.addEventListener("change", update);
    return () => pointerQuery.removeEventListener("change", update);
  }, []);

  const signals: SignalPath[] = [
    {
      id: "signal-left-1",
      d: "M 24 225 C 210 225, 405 320, 620 405",
      duration: 11,
      delay: 0,
      side: "left",
    },
    {
      id: "signal-left-2",
      d: "M 24 390 C 225 390, 420 410, 620 425",
      duration: 14,
      delay: 2.2,
      side: "left",
    },
    {
      id: "signal-left-3",
      d: "M 24 555 C 215 555, 405 500, 620 445",
      duration: 9.5,
      delay: 4.1,
      side: "left",
      tertiary: true,
    },
    {
      id: "signal-right-1",
      d: "M 1416 225 C 1230 225, 1035 320, 820 405",
      duration: 12.5,
      delay: 1.1,
      side: "right",
    },
    {
      id: "signal-right-2",
      d: "M 1416 390 C 1215 390, 1020 410, 820 425",
      duration: 10,
      delay: 3.3,
      side: "right",
    },
    {
      id: "signal-right-3",
      d: "M 1416 555 C 1225 555, 1035 500, 820 445",
      duration: 13.5,
      delay: 5,
      side: "right",
      tertiary: true,
    },
  ];

  const entrance = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease },
    },
  };

  return (
    <section
      ref={heroRef}
      className="hero-static"
      onPointerMove={(event) => {
        if (!spotlightEnabled || reducedMotion) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        pointerX.set(event.clientX - bounds.left - 160);
        pointerY.set(event.clientY - bounds.top - 160);
      }}
      onPointerLeave={() => {
        pointerX.set(-400);
        pointerY.set(-400);
      }}
    >
      <div className="hero-grid" aria-hidden="true" />
      {spotlightEnabled && !reducedMotion && (
        <motion.div
          aria-hidden="true"
          className="hero-grid-spotlight"
          style={{ x: spotlightX, y: spotlightY }}
        />
      )}
      <div className="hero-glow" />

      <svg
        aria-hidden="true"
        className="hero-signals"
        viewBox="0 0 1440 800"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="signal-left-fade" x1="0" x2="1">
            <stop offset="0" stopColor="var(--border-hairline)" stopOpacity=".5" />
            <stop offset=".76" stopColor="var(--border-hairline)" stopOpacity=".35" />
            <stop offset="1" stopColor="var(--border-hairline)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="signal-right-fade" x1="1" x2="0">
            <stop offset="0" stopColor="var(--border-hairline)" stopOpacity=".5" />
            <stop offset=".76" stopColor="var(--border-hairline)" stopOpacity=".35" />
            <stop offset="1" stopColor="var(--border-hairline)" stopOpacity="0" />
          </linearGradient>
          <filter id="signal-dot-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {signals.map((signal, index) => (
          <g
            key={signal.id}
            className={signal.tertiary ? "signal-tertiary" : undefined}
          >
            <motion.path
              d={signal.d}
              fill="none"
              stroke={`url(#signal-${signal.side}-fade)`}
              strokeWidth="1"
              initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={
                entered
                  ? {
                      pathLength: 1,
                      opacity:
                        !reducedMotion && heroInView
                          ? [0.55, 0.9, 0.55]
                          : 0.55,
                    }
                  : { pathLength: 0, opacity: 0 }
              }
              transition={{
                pathLength: { duration: 1.6, ease },
                opacity:
                  !reducedMotion && heroInView
                    ? {
                        duration: 6,
                        delay: index * 0.55,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                    : { duration: 0.4 },
              }}
            />
            {!reducedMotion && heroInView && (
              <circle
                r="4"
                fill="var(--accent-solid)"
                fillOpacity=".45"
                filter="url(#signal-dot-glow)"
              >
                <animateMotion
                  path={signal.d}
                  dur={`${signal.duration}s`}
                  begin={`${signal.delay}s`}
                  repeatCount="indefinite"
                  calcMode="linear"
                />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;.12;.78;1"
                  dur={`${signal.duration}s`}
                  begin={`${signal.delay}s`}
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        ))}
        {[225, 390, 555].map((y, index) => (
          <g
            key={`mail-${y}`}
            className={`signal-node ${index === 2 ? "signal-tertiary" : ""}`}
            transform={`translate(17 ${y - 5})`}
          >
            <rect width="11" height="9" rx="1.5" fill="none" stroke="currentColor" />
            <path d="m1.5 2 4 3 4-3" fill="none" stroke="currentColor" />
          </g>
        ))}
        {[225, 390, 555].map((y, index) => (
          <g
            key={`calendar-${y}`}
            className={`signal-node ${index === 2 ? "signal-tertiary" : ""}`}
            transform={`translate(1411 ${y - 5})`}
          >
            <rect width="11" height="10" rx="1.5" fill="none" stroke="currentColor" />
            <path d="M2 0v3M9 0v3M1 4h9" fill="none" stroke="currentColor" />
          </g>
        ))}
      </svg>

      <motion.div
        className="hero-content"
        initial={reducedMotion ? false : "hidden"}
        animate={entered ? "visible" : "hidden"}
        transition={{ staggerChildren: 0.07 }}
      >
        <motion.p className="hero-eyebrow" variants={entrance}>
          THE AI COMMAND CENTER
        </motion.p>
        <h1>
          <motion.span className="hero-line-one" variants={entrance}>
            Your inbox and calendar,
          </motion.span>
          <span className="hero-line-mask">
            <motion.span className="hero-line-two" variants={entrance}>
              one command away.
            </motion.span>
          </span>
        </h1>
        <motion.p className="hero-summary" variants={entrance}>
          Ask in plain English. Nexus reads your email, checks your schedule and
          gets things done, with your approval.
        </motion.p>
        <motion.div className="hero-actions" variants={entrance}>
          <a
            href="#early-access"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById("email");
              if (el) {
                el.scrollIntoView({ behavior: "smooth" });
                el.focus();
              }
            }}
            className="button button-primary text-white"
          >
            Get early access
          </a>
          <a
            href="https://github.com"
            className="button button-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GithubIcon /> View on GitHub
          </a>
        </motion.div>
        <motion.p className="mono-footnote hero-footnote" variants={entrance}>
          GMAIL · GOOGLE CALENDAR · MORE COMING
        </motion.p>
      </motion.div>
      <a
        href="#how-it-works"
        className={`hero-scroll-cue ${heroInView ? "" : "is-paused"}`}
      >
        See how it works <span>↓</span>
      </a>
    </section>
  );
}
