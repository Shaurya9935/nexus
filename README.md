# Nexus

> One command for your inbox and calendar.

Nexus is an AI-powered productivity workspace that unifies **Gmail** and **Google Calendar** into a single, cohesive command center. Designed for professionals who want to eliminate tab switching, Nexus lets users search, read, triage, draft, and schedule through natural language or direct visual controls.

> [!NOTE]
> **Beta Status**: Nexus is in active beta. Features are live and under continuous refinement. External access is currently subject to Google's OAuth testing-mode verification rules for Gmail and Calendar access.

- **Production URL**: `TODO: Add production deployment URL`
- **Repository**: [github.com/Shaurya9935/nexus](https://github.com/Shaurya9935/nexus)

---

## What Works Today

- **Authentication & Access Control**: Email/password authentication with 6-digit OTP email verification via Resend, Google OAuth social login, configurable invite/open sign-up modes (`SIGNUP_MODE`), waitlist management with an admin dashboard, and full user data deletion.
- **Unified Gmail Inbox**: Background incremental sync with PostgreSQL caching, multi-message thread viewer with parsed HTML rendering, starred thread view with live star toggling, and inbox search.
- **Multi-View Calendar**: Interactive Day, Week (hourly grid with live time indicator), Month, and Agenda views with one-click Google Meet conferencing generation on event creation.
- **Natural Language Command Center**: OpenAI Agents SDK runner with deterministic custom tools (`get_recent_emails`, `search_emails`, `get_calendar_events`, `send_email`, `create_calendar_event`) and generic Corsair API tool fallback.
- **Human-in-the-Loop Safety**: Cautious permission gate requiring explicit interactive approval cards before sending emails or creating events; prompt-injection defenses with untrusted data boundaries.
- **Usage & Rate Limits**: Per-user burst protection (8 msg/min), daily message limits (50 msg/day), and aggregate daily token tracking via the `ai_usage` table.
- **Theming & Polish**: Semantic design tokens with warm charcoal dark mode, `pnpm check:colors` guardrail, guided onboarding tour, and interactive landing page.

---

## How It Works

```text
User / Browser
      │
      ▼
Nexus (Next.js 16 + OpenAI Agents SDK)
      │
      ▼
Corsair Integration Engine (Permissions & Envelope Encryption)
      ├───────────────────────────────┐
      ▼                               ▼
Google Gmail API             Google Calendar API
```

### Application Identity vs. Service Integrations

```text
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│         Application Identity         │       │         Service Integrations         │
│             Better Auth              │       │         Corsair OAuth Engine         │
├──────────────────────────────────────┤       ├──────────────────────────────────────┤
│ • User registration & passwords      │       │ • Google Workspace OAuth tokens      │
│ • 6-digit email OTP (via Resend)     │  vs   │ • Per-account AES-256-GCM encryption │
│ • Session cookies & route guard      │       │ • Cautious permission approvals      │
│ • Waitlist gating & admin dashboard  │       │ • Background API sync & cache        │
└──────────────────────────────────────┘       └──────────────────────────────────────┘
```

---

## Tech Stack

- **Framework & Runtime**: Next.js 16 (App Router), React 19, TypeScript 5, Node.js 24.x
- **Database & ORM**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth (with Drizzle PostgreSQL adapter)
- **Integration Engine**: Corsair SDK (`@corsair-dev/gmail`, `@corsair-dev/googlecalendar`, `@corsair-dev/mcp`)
- **AI Engine**: OpenAI Agents SDK (`@openai/agents`) with GPT-4o
- **Email Delivery**: Resend
- **Styling**: Tailwind CSS v4 & Semantic CSS Variables
- **Package Manager**: pnpm
- **Deployment**: Heroku with Heroku Postgres (see deployment notes)

---

## Getting Started

### Prerequisites

- **Node.js**: `24.x` (enforced via `package.json` engines)
- **pnpm**: `10.x` or higher
- **Docker**: For running a local PostgreSQL instance (or an external PostgreSQL URL)
- **API Keys**: Google Cloud OAuth Client (Gmail & Calendar scopes), OpenAI API key, Resend API key

### 1. Clone & Install

```bash
git clone https://github.com/Shaurya9935/nexus.git
cd nexus
pnpm install
```

### 2. Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env.local
```

Configure the following variable categories in `.env.local` (variable names only; never commit secrets):
- `APP_URL` / `BETTER_AUTH_URL`: Canonical public origin (e.g. `http://localhost:3000`).
- `DATABASE_URL`: Connection string to PostgreSQL instance.
- `BETTER_AUTH_SECRET`: Secret key (min 32 characters) for signing auth sessions.
- `CORSAIR_KEK`: 32-byte Base64-encoded Key Encryption Key for at-rest token encryption.
- `CORSAIR_DEV_API_KEY` / `CORSAIR_DEV_SIGNING_SECRET`: Corsair integration API credentials.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth credentials with Gmail and Calendar scopes.
- `OPENAI_API_KEY`: API key powering the AI agent runner.
- `RESEND_API_KEY` / `MAIL_FROM`: Resend credentials for 6-digit email OTP verification.
- `REQUIRE_EMAIL_VERIFICATION`: Set to `true` to mandate OTP verification on registration.
- `SIGNUP_MODE` / `ADMIN_EMAILS` / `ALLOWED_EMAILS`: Control open vs invite registration and admin access.
- `AI_DAILY_MESSAGE_LIMIT` / `AI_BURST_MESSAGE_LIMIT` / `AI_DAILY_TOKEN_BUDGET_TOTAL`: AI spend caps.

### 3. Database Migration & Development

```bash
# Run database migrations
pnpm db:migrate

# Start local Next.js development server
pnpm dev
```

### 4. Verification Commands

```bash
pnpm lint          # Runs ESLint checks
pnpm check:colors   # Enforces semantic design tokens (no hardcoded colors)
```

---

## Project Structure

- `app/`: Next.js App Router pages, layout trees, error boundaries, and API route handlers (`app/api/*`).
- `features/<service>/`: Domain feature modules (Gmail, Calendar) containing AI tools, schemas, and server services.
- `lib/ai/`: Core agent runner, instructions, prompt-injection defenses, and pending action queries.
- `lib/ai/tools/`: Central tool registry aggregating feature-specific tools and Corsair generic tool bridges.
- `components/`: UI components (inbox, calendar, dashboard, auth, theme, onboarding, landing page).
- `db/`: Drizzle ORM schema definitions (auth, corsair, ai_usage, waitlist, onboarding).

### Layering Rule
Code strictly adheres to:
`Route / API Handler (app/api/*)` &rarr; `AI Tools (features/*/ai-tools.ts)` &rarr; `Service Layer (features/*/server.ts)` &rarr; `Corsair SDK / Drizzle DB`

---

## Security & Privacy

- **Minimal Scopes & Storage**: Nexus stores user profile details and caches essential email/calendar metadata locally in PostgreSQL for sub-second retrieval.
- **Envelope Encryption**: Third-party OAuth tokens are encrypted at rest with AES-256-GCM using per-account Data Encryption Keys (DEKs) wrapped by `CORSAIR_KEK`.
- **Human Approval Required**: Outbound actions (sending emails, creating calendar events) require explicit confirmation via interactive cards before execution.
- **User Data Deletion**: Users can purge their cached data and revoke Google OAuth tokens at any time via Account settings.

---

## Roadmap

1. **Mail Triage & Insights**: Structured classification (needs reply, FYI, newsletter) and action extraction.
2. **Reply Reminders & Follow-Ups**: Proactive background alerts for unanswered emails via Resend and in-app notifications.
3. **Context-Aware Mini Bot**: Instant suggestion chips and contextual assistance tailored to the active thread or event.
4. **Native Calendar Event Management**: Event editing modal and delete confirmation dialogs with undo support.
5. **Connector Expansion**: Dedicated integrations for GitHub and Notion.

For detailed priorities, bug triage, and task tracking, see [docs/ROADMAP.md](docs/ROADMAP.md).

---

## Contributing & License

Contributions are welcome. Please ensure all modifications pass `pnpm lint` and `pnpm check:colors` before opening a pull request.

Private beta &mdash; all rights reserved.
