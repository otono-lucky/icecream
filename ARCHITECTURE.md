# Architecture

icecream is organised by feature. Each feature owns its screens, components, hooks, API calls and types. Routes are thin files that point at feature screens.

```
src/            The Expo app.
  app/          Expo Router routes only. Each file re-exports a screen from a feature.
  features/     One folder per product area (see below).
  shared/       Code that knows nothing about any feature: UI kit, API client, route helpers.
  providers/    AppProviders, the one place app-wide providers are stacked.
  global.css    Tailwind entry for NativeWind.
server/         The API: a Cloudflare Worker (Hono) with D1 for data and R2 for images.
admin/          The admin website for the icecream team: React + Vite, its own package.json.
contracts/      Plain TypeScript shared by all three: API types and rules every side must agree on
                (minimum age, onboarding steps, plans, labels). Imported as `@contracts`.
```

## Features

| Feature        | Owns                                                                 | PRD      |
| -------------- | -------------------------------------------------------------------- | -------- |
| `auth`         | Welcome, phone + OTP, the session and its status                     | 4.1      |
| `verification` | Age gate, basic details, photo liveness, optional ID, pending status | 3.1, 4.1 |
| `profile`      | Profile model, builder steps, preview, my profile, section editing   | 3.2, 4.2 |
| `discovery`    | Daily matches, member profile, filters                               | 3.3, 4.3 |
| `interests`    | Express interest / pass, interests received, quiet decline           | 3.4, 4.3 |
| `messaging`    | Conversations, chat, the Message button's routing rule               | 3.4, 4.4 |
| `subscription` | Messaging paywall, pricing rules, plan, receipts                     | 3.9, 4.7 |
| `safety`       | Report and block                                                     | 3.8, 4.4 |
| `settings`     | Settings, privacy controls, sign out, delete account                 | 4.7      |

Phase 2 (premium matchmaking, video, matchmaker console) will arrive as new features, for example `features/premium` and `features/calls`. The web admin is a separate app, not part of this one.

Inside a feature, use only the folders it needs:

```
features/<name>/
  index.ts      Public API. The only file other code may import from.
  screens/      Screen components, re-exported by routes in src/app.
  components/   UI used by this feature's screens, or exported for other features.
  hooks/
  api/          Backend calls. Screens never call fetch directly.
  types.ts
```

## Import rules

1. Import another feature only through its `index.ts`: `@/features/profile`, never `@/features/profile/components/...`.
2. `shared/` never imports from `features/`.
3. Feature dependencies go one way. Today's graph:

   ```
   discovery    → interests, messaging, profile, safety
   messaging    → safety, subscription
   verification → auth, profile
   subscription → auth
   settings     → auth
   ```

   If a new import would create a cycle, move the shared piece down into the lower feature or into `shared/`.
4. Navigate with the helpers in `src/shared/navigation/routes.ts`, not hard-coded paths, so routes can move safely.

## Navigation and access

`src/app/_layout.tsx` exposes exactly one route group at a time, based on `session.status`:

| Status       | Group          | Contents                                                          |
| ------------ | -------------- | ----------------------------------------------------------------- |
| `signedOut`  | `(public)`     | Welcome, phone, OTP                                               |
| `onboarding` | `(onboarding)` | Age gate → details → photos → selfie → ID (optional) → pending    |
| `active`     | `(app)`        | Tabs (Today, Interests, Messages, Me) plus pushed screens          |

The status comes from the server. Every onboarding endpoint returns the member's `Me`, which includes `onboarding.nextStep`; the app stores it and routes to that step (`useAdvanceOnboarding`). A member only becomes `active` when a reviewer passes their selfie check.

Screens don't navigate across groups. They change the session and the guard redirects to the **first screen declared** in the newly reachable group's layout. In `(onboarding)` that's `index`, which resumes at `nextStep`, so an interrupted sign-up picks up where it left off.

These guards are client-side only. The backend must enforce the same rules: no browsing before verification, no messaging without payment.

## Design system

The screens follow the Stitch designs (`docs/design/stitch/`). Tokens live in `src/shared/ui/tokens.json` and feed both Tailwind classes and `colors` (for icon and gradient props):

- **Colours:** wine `#9E3D48` (actions), ivory `#FAF8F5` (background), verified green `#2D6A4F`, review amber `#B45309`, sand (notice cards), charcoal (dark buttons).
- **Type:** Plus Jakarta Sans, one family per weight. Render all text through `AppText` with `weight` and `tone`, never raw `Text`, so the font and colours stay consistent.
- **Components** (`src/shared/ui`): `Button` (primary, secondary, dark, text; 52pt tall), `Field`, `ErrorBanner`, `ErrorText`, `NoticeCard`, `OnboardingHeader` with the 6-step progress bar, `StepLabel`, `Wordmark`.
- **Icons:** Material Community Icons via `Icon`.

## Product rules and where they live

- **Payment is the gate to speak:** `useMessagingAccess` (subscription) decides access, and `useStartConversation` (messaging) sends a Message tap to either the chat or the paywall.
- **Pricing and women's launch pricing:** `features/subscription/pricing.ts`. The final numbers are still open questions in the PRD.
- **Age limit (35+):** `features/verification/lib/age.ts`.

## Backend

`server/` is organised by feature like the app (`src/features/auth`, `me`, `verification`, `admin`). Schema changes are D1 migrations in `server/migrations/`.

```bash
cd server
cp .dev.vars.example .dev.vars   # first time only
npm run db:migrate:local         # apply migrations to the local D1
npm run dev                      # API on http://localhost:8787 (with EMAIL_PROVIDER=console the code is 123456)
npm test                         # integration tests against a real local Worker, D1 and R2
npm run admin -- add <email> "<name>"   # give someone access to the admin website (also: disable, enable, list; --remote for live)
npm run seed:local               # add verified women with photos (seed/) to the local database (safe to re-run)
```

- **Sessions:** a random bearer token, stored hashed in D1 and in SecureStore on the phone. Valid for 90 days.
- **OTP:** members sign in with an email address only (phone sign-in was removed; older accounts keep their `phone` column, unused). Codes are 6 digits, stored hashed with a pepper. Codes expire after 10 minutes; a code locks after 5 wrong tries; 60 s between sends; at most 5 per hour.
- **Sign-in emails:** sent over SMTP (`EMAIL_PROVIDER=smtp`, see `server/src/features/auth/email.ts`). Any provider works on port 465 or 587; for now a Gmail account with an app password (about 500 emails a day). With a domain, point the `SMTP_*` settings at a domain provider instead; no code changes. Locally, `EMAIL_PROVIDER=console` prints codes in the terminal.
- **Selfie check:** for the MVP, a live selfie reviewed by a person against the member's photos. An automated liveness vendor can replace the review later.
- **Messaging:** chats are keyed by the other member (`/v1/chats/:memberId`); the app checks for new messages every 3 seconds while a chat is open. Reading is free; sending needs `billingStatus().canMessage` (women free at launch, men on a plan).
- **Payments:** `BILLING_PROVIDER=fake` serves a test checkout page (`/v1/billing/fake-checkout/…`, never in production). Plans and prices are in `contracts/billing.ts`. Paystack plugs in as `BILLING_PROVIDER=paystack`.
- **Team emails:** `features/admin/emails.ts`. An email to one member sends at once. Announcements go into `email_outbox` and are sent about 20 a minute by the every-minute cron (`scheduled` in `src/index.ts`), also nudged right after queuing and when the Emails page is opened (local dev has no cron), capped at `EMAIL_DAILY_LIMIT` a day so Gmail's ~500/day leaves room for sign-in codes. Announcements carry a signed unsubscribe link (`/v1/email/unsubscribe`, asks before acting, supports one-click from mail apps); unsubscribed, suspended and under-35 members never get them. `{name}` in a subject or message becomes the member's first name.
- **Admin:** `/v1/admin` serves the admin website. Admins are a separate `admins` table (not members), sign in with an emailed code (`/v1/admin/auth`, stored apart from member codes), and get 12-hour sessions. Every check decision, report outcome, suspension and restore is written to `admin_actions` with who did it and why. Suspending signs the member out and hides them everywhere; restoring returns them to active if their selfie check passed.

## Admin website

`admin/` is a small React site (Vite, no router library: `src/router.tsx`). Pages: Overview, Checks (a filterable table; approve or reject selfie and ID checks, with the reason the member sees), Reports, Members (search, full detail, suspend and restore, email one member), Emails (announcements to a filtered group, with a recipient count, a test to yourself and per-recipient progress) and Payments. It reads images through the API with the admin's token.

```bash
cd admin
cp .env.example .env    # first time only; VITE_API_URL points at the API
npm install
npm run dev             # http://localhost:5173 (the API must allow it in CORS_ORIGINS)
npm run build           # static files in dist/, ready for Cloudflare Pages or Workers static assets
```

## Built so far

| Part | PRD | State |
| ---- | --- | ----- |
| 1. Onboarding and verification | 3.1, 4.1 | Done, from Stitch designs. Sign-in is email only. |
| 2. Profile | 3.2, 4.2 | Done, from Stitch designs |
| 3. Today's introductions and interest | 3.3, 4.3 | Done, from Stitch designs |
| 4. Messaging and payments | 3.4, 3.8, 4.4 | Done with a test checkout; real Paystack not connected |
| Report and block | 3.9, 4.7 | Done; privacy settings, pause and delete account still to build |
| Admin website | 3.10 | Done: checks, reports, members, payments. Plain design (internal tool). |
| Filters | 3.3 | Not built (empty screen) |

## Not decided yet

- Automated liveness and ID vendor, if any
- Data fetching and caching library (`shared/lib/useAsync` is a stand-in)
- Realtime chat (polling every 3 s today; Durable Objects with WebSockets is the upgrade)
