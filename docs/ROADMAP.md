# Nexus Roadmap

> **Last updated:** 2026-10-28
>
> **How to use this file:** Pick at most 3 items for **This week**. When an item is completed, move it to the **Done log** at the bottom with the completion date.

---

## This week (max 3)

<!-- Owner: Pick at most 3 active items from the sections below for this week -->
- [ ] *Placeholder: Select an active focus item*

---

## A. Bugs and polish (triage first)

- [ ] **[P0]** Clean snippets: Decode raw HTML entities (`&#39;`, `&amp;`) and strip markdown images (`![img](...)`) when parsing email snippets — *Why: Corrupted snippets look unpolished and confuse users.*
- [ ] **[P0]** Wire real calendar event deletion in UI with confirmation modal — *Why: Clicking delete currently only clears local React state and leaves the event active in Google Calendar and the database.*
- [ ] **[P0]** Implement calendar event edit modal and API route — *Why: The "Edit" button in the event popover has no attached handler and cannot modify events.*
- [ ] **[P1]** Fix automated/no-reply senders tagged "Needs reply" — *Why: Automated notifications and newsletters currently trigger false urgency in the inbox.*
- [ ] **[P1]** Isolate email body styles with light paper container — *Why: External email CSS leaks into the application (e.g. blue-on-blue buttons); requires an isolated container rendering with a light paper background in both themes.*
- [ ] **[P1]** Dim past events in Today panel and deduplicate "until &lt;event&gt;" stat — *Why: Redundant metrics and unmuted past events clutter the dashboard focus card.*
- [ ] **[P1]** Consolidate navigation layouts — *Why: Having both a wide sidebar and an icon rail + contextual column creates visual jumping and inconsistent UX.*
- [ ] **[P1]** Remove or mark "Soon" for Outlook in the sidebar — *Why: Outlook is purely simulated in code and misleadingly appears alongside working integrations.*
- [ ] **[P1]** Implement email archive action in UI and backend — *Why: Archiving threads is currently missing from the inbox and only accessible through generic AI fallback.*
- [ ] **[P1]** Sync read/unread state to database and Gmail API — *Why: Clicking a thread only updates ephemeral local state and does not persist across reloads or sync to Gmail.*
- [ ] **[P2]** Improve light mode muted text contrast and add chat title actions — *Why: Some text falls below WCAG AA contrast, and long chat titles cannot be renamed or deleted.*
- [ ] **[P2]** Upgrade `@types/node` to `^24` — *Why: Types are currently on `^20` while package engines target Node `24.x`.*
- [ ] **[P2]** Add Dependabot configuration (`.github/dependabot.yml`) — *Why: Missing automated dependency vulnerability alerts.*

---

## B. Production readiness

- [ ] **[P0]** Security hygiene sweep — *Why: Scan repository history for secrets, rotate existing credentials, and enforce 2FA across GitHub, Heroku, Google Cloud, OpenAI, Resend, and domain registrar.*
- [ ] **[P0]** OpenAI spending cap and alert thresholds — *Why: Guards against runaway API bills from unexpected traffic bursts or model loops.*
- [ ] **[P0]** Google OAuth verification path decision — *Why: Choose between Calendar-only first, full Gmail security assessment, or closed beta; publish privacy policy, terms, and data-deletion URL to remove Google test-user limits.*
- [ ] **[P1]** Webhook push notifications with polling fallback — *Why: Replaces manual refreshes with near-instant sync for Gmail and Google Calendar updates.*
- [ ] **[P1]** Graceful Google OAuth token expiry reconnect flow — *Why: Expired or revoked credentials should present an in-app reconnect modal without crashing views.*
- [ ] **[P1]** Error monitoring integration (Sentry or equivalent) — *Why: Real-time visibility into unhandled client errors and failed server sync jobs.*
- [ ] **[P1]** Per-user AI cost observability from `ai_usage` — *Why: Measure real token expenditures per active user to determine plan margins.*
- [ ] **[P2]** Billing infrastructure (Stripe integration & tier limits) — *Why: Gate usage once per-user unit economics are established.*
- [ ] **[P2]** Support channel and status page with simple funnel telemetry — *Why: Monitor conversion through signup &rarr; connected &rarr; first command &rarr; day 2 return.*
- [ ] **[P2]** Enforce pnpm `minimumReleaseAge` if supported — *Why: Protects build pipeline against newly published supply-chain dependencies.*

---

## C. Product (tier 1, in order)

- [ ] **[P1]** 1. Mail triage system (`email_insights` table) — *Why: Structured classification (needs_reply, fyi, waiting, newsletter), summaries, and action items via small model; includes evaluation set of ~30 labeled emails.*
- [ ] **[P1]** 2. Reply reminders and follow-up alerts — *Why: `reminders` table and background scheduler delivering notifications via Resend and the in-app bell with snooze and IST handling.*
- [ ] **[P1]** 3. Context-aware mini bot — *Why: `useScreenContext` hook with zero-cost static chips, cached insights, and on-click AI actions with approval cards across mail thread, calendar, and future tools.*
- [ ] **[P2]** 4. GitHub and Notion integration spike (1–2 days) — *Why: Connect via generic Corsair tools without custom wrappers to measure agent reliability on real developer tasks.*

---

## D. Product (tier 2)

- [ ] **[P2]** Thread-to-meeting scheduling — *Why: Propose available slots, draft reply, and create calendar invite from a single confirmation card.*
- [ ] **[P2]** Morning brief email via Resend — *Why: Daily morning digest summarizing urgent correspondence, day density, and scheduled calls.*
- [ ] **[P2]** Sent mail follow-up tracker ("waiting on" list) — *Why: Surfaces outbound threads where the recipient has not replied.*
- [ ] **[P2]** Draft replies in the user's voice — *Why: Matches user tone and signing habits based on recent outbound emails.*
- [ ] **[P2]** Meeting preparation brief — *Why: Automatically compiles attendee bios and past email exchanges before a scheduled event.*
- [ ] **[P2]** Unified cross-service search — *Why: Fast PostgreSQL full-text search across messages, events, and contacts in a single query.*
- [ ] **[P2]** Command bar (&#8984;K) quick actions — *Why: Instant keyboard navigation and common productivity shortcuts without typing full prompts.*
- [ ] **[P2]** AI agent benchmark evaluation suite (30–50 tasks) — *Why: Prevents accuracy and tool-calling regressions during model or prompt iterations.*

---

## E. Phase 2 leftovers

- [ ] **[P1]** Calendar delete/cancel confirmation dialog — *Why: Prevents accidental calendar deletions on misclicks.*
- [ ] **[P1]** Undo snackbar for destructive inbox and schedule actions — *Why: Gives users immediate recovery for accidental archival, trashing, or removal.*
- [ ] **[P1]** Dedicated email archive endpoint and UI control — *Why: Cleanly clears threads from the inbox without deletion.*
- [ ] **[P1]** Bidirectional read/unread synchronization with Gmail API — *Why: Keeps read status synchronized across all devices and Gmail clients.*

---

## F. Go-to-market (later, after product works)

- [ ] **[P2]** Target audience DM validation — *Why: Test developers vs. students/job seekers with 10 one-line pitches each to identify the highest-converting segment.*
- [ ] **[P2]** 1-on-1 onboarding for 5 beta testers — *Why: Walk users through setup, warn about Google's testing notice, and collect day 3 and day 7 feedback.*
- [ ] **[P2]** Track core retention benchmark — *Why: Validate that at least 3 of 5 testers use Nexus 3+ days a week before scaling invites.*
- [ ] **[P2]** Refine landing page copy for validated audience — *Why: Focus hero messaging directly on the primary use case that retained testers.*
- [ ] **[P2]** Wire final logo and favicon assets across all pages — *Why: Polishes visual branding across login, navbar, and landing screens.*

---

## G. Open decisions

- **Target audience:** Developers vs. students / job seekers
  Decision: 

- **Pricing model:** Flat subscription vs. usage credits vs. generous free tier
  Decision: 

- **Gmail verification path:** Calendar-only first vs. full CASA assessment vs. closed beta
  Decision: 

- **Integration scope:** Keep Outlook in scope or focus purely on Google Workspace
  Decision: 

---

## Done log

- **2026-10-28:** Better Auth authentication with email/password, email OTP verification via Resend, and Google OAuth login ([lib/auth.ts](../lib/auth.ts)).
- **2026-10-28:** Multi-view Calendar (Day, Week, Month, Agenda) with live time indicator and Google Meet integration ([components/calendar/week-view.tsx](../components/calendar/week-view.tsx)).
- **2026-10-28:** Gmail inbox thread synchronization with PostgreSQL caching and background sync locks ([features/gmail/server.ts](../features/gmail/server.ts)).
- **2026-10-28:** Starred thread view and star toggle with persistent database and Gmail sync ([components/inbox/starred-view.tsx](../components/inbox/starred-view.tsx)).
- **2026-10-28:** Human-in-the-loop permission flow via Corsair requiring approval cards for email sending and event creation ([lib/ai/pending-actions.ts](../lib/ai/pending-actions.ts)).
- **2026-10-28:** AI spend protection and rate limiting tracked atomically in `ai_usage` table ([db/ai-usage.ts](../db/ai-usage.ts)).
- **2026-10-28:** Prompt-injection defense marking email and calendar data untrusted in agent instructions ([lib/ai/instructions.ts](../lib/ai/instructions.ts)).
- **2026-10-28:** Semantic design tokens with warm charcoal dark mode and `pnpm check:colors` CI guardrail ([app/globals.css](../app/globals.css)).
- **2026-10-28:** Interactive onboarding tour guided by DOM element targeting ([components/onboarding/tour-provider.tsx](../components/onboarding/tour-provider.tsx)).
- **2026-10-28:** Scrollytelling interactive landing page and responsive demo frame ([app/page.tsx](../app/page.tsx)).
- **2026-10-28:** Early-access waitlist database table, approval endpoints, and admin review dashboard ([app/dashboard/admin/waitlist/page.tsx](../app/dashboard/admin/waitlist/page.tsx)).
- **2026-10-28:** Account settings page with connected apps management, password updates, and user data deletion ([app/dashboard/account/page.tsx](../app/dashboard/account/page.tsx)).
