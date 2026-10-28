<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Architecture

## Layering Rule
Code in this codebase follows a strict feature-based layered architecture:
- **Routes & Handlers** (`app/api/*`): Parse request, authenticate session, invoke agent/services, format response.
- **AI Agent Runner** (`lib/ai/agent.ts`): Orchestrates prompt instructions, history formatting, tool invocation, and pending actions querying. Target ≤120 lines.
- **AI Tools** (`features/<service>/ai-tools.ts`): Define deterministic schemas (`strictTool`) and execute handlers. **AI tools must NOT contain raw Corsair API calls or Drizzle queries directly.** Instead, tools delegate all data retrieval and mutation to the feature's service layer.
- **Service Layer** (`features/<service>/server.ts`): Encapsulates all Corsair SDK operations, Drizzle ORM cache queries, and business logic. Functions accept `TenantCorsair` or session context and return typed result interfaces.
- **Integrations & Data Access** (`lib/corsair.ts`, `lib/db.ts`, `db/*`): Core SDK clients, database connection pool, and table schemas.

## Adding New Integrations
When adding a new integration (e.g., Slack, Notion):
1. Add service functions in `features/<service>/server.ts`.
2. Define the tool schemas and delegates in `features/<service>/ai-tools.ts`.
3. Register the tools with a single line in `lib/ai/tools/index.ts`:
   ```ts
   export function buildTools(ctx: ToolContext): Tool<unknown>[] {
     return [
       ...gmailTools(ctx),
       ...calendarTools(ctx),
       ...newServiceTools(ctx),
     ];
   }
   ```

## Theming & Design Tokens
All UI colors across `app/`, `components/`, `features/`, and `hooks/` MUST use semantic design tokens defined via CSS variables (`var(--...)`).

### Rules:
1. **No Hardcoded Color Literals**: Never write hex colors (`#hex`), raw `rgb()`/`rgba()`, `hsl()`/`hsla()`, or arbitrary non-token Tailwind color utility classes (e.g., `text-zinc-500`, `bg-slate-100`). Always reference semantic variables such as `var(--text-primary)`, `var(--bg-page)`, `var(--surface-card)`, `var(--border-hairline)`, `var(--accent-solid)`, etc.
2. **Warm Charcoal Dark Mode**: Dark mode is activated via the `.dark` class on `<html>` and defined entirely by overriding token values in `app/globals.css`. It uses warm charcoal neutrals (`#121110`, `#151412`, `#171614`, `#1D1C1A`, `#21201D`, `#252421`, `#EEEBE5`, and warm beige hairline borders), avoiding cold blue or pure black tones.
3. **Allowlisted Exceptions**:
   - `app/globals.css`: Central source of truth for `:root` and `.dark` token values.
   - `components/connect/brand-icons.tsx`: Official third-party brand logo SVG vectors (Google, Microsoft, Slack, Notion, Zoom, etc.).
   - `components/auth/icons.tsx`: Official 4-color Google authentication logo.
   - `components/inbox/email-body.tsx`: Isolated email paper container that intentionally maintains fixed `#FFFFFF` card background with `#2D2C2A` text so formatted HTML emails render with authentic contrast in both modes.
4. **Guardrail Linter**: Run `pnpm check:colors` to verify that all code adheres to design tokens. CI and pull requests must pass `pnpm check:colors` with exit code 0.

## Task Completion
When you finish a task, update docs/ROADMAP.md (move the item to the Done log) and README.md if user-visible behavior changed.


