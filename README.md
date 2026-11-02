# XPO — Express/Prisma Backend + React Admin Panel

XPO is a mobile market-app workspace with three parts:

| Part | Directory | Description |
| --- | --- | --- |
| Mobile frontend | `src/` | Existing React app — intentionally untouched except a minimal live-price overlay |
| Backend API | `backend/` | Express 5 + Prisma 6 (PostgreSQL) REST API with IBRLive forex integration |
| Admin panel | `admin/` | Separate React (Vite) SPA for operators |

## Quick start

```bash
# 1. install
npm install
npm --prefix backend install
npm --prefix admin install

# 2. configure the backend
cp backend/.env.example backend/.env   # then fill in values

# 3. migrate + seed (markets + admin user)
npm --prefix backend run prisma:migrate   # or: npx prisma migrate dev
npm --prefix backend run prisma:seed

# 4. run
npm run dev:backend    # API on http://localhost:4000
npm run dev            # user frontend on http://localhost:5173 (proxies /api → :4000)
npm run dev:admin      # ADMIN panel on http://localhost:5174/admin (proxies /api → :4000)
```

## Scripts (root)

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `preview` | Mobile frontend (Vite) |
| `npm run lint` | ESLint across frontend, backend and admin |
| `npm run test` | Backend API test suite (`node --test`, no extra deps) |
| `npm run dev:backend` | Backend with watch |
| `npm run dev:admin` | Admin panel dev server |
| `npm run build:admin` | Production build of the admin panel |

## Environment variables (`backend/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string (Prisma) |
| `JWT_SECRET` | yes (forced in prod) | User + admin token signing |
| `IBRLIVE_API_KEY` | for live forex | IBRLive provider key (masked in logs, never exposed via API) |
| `IBRLIVE_BASE_URL` | no | Override provider base URL (used with mock servers) |
| `FOREX_SYMBOLS` | no | Comma list, default `USDINR,EURINR,GBPINR` |
| `FOREX_REFRESH_INTERVAL_SECONDS` | no | Scheduler cadence, default `80` |
| `FOREX_MONTHLY_REQUEST_LIMIT` | no | Quota gate, default `35000` |
| `FOREX_WARNING_THRESHOLD` | no | SystemLog warning at, default `30000` |
| `CRYPTO_PROVIDER_URL` / `CRYPTO_API_KEY` | for crypto | Crypto endpoint — until set, crypto API returns `503` (never fake prices) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | for seed | Admin login created by `prisma:seed` |
| `CORS_ORIGIN` | no | Comma list — must include the admin/frontend origins |

## API overview

- **Public:** `GET /api/health`, `POST /api/auth/{register,login}`, `GET /api/auth/me`,
  `GET /api/markets/{forex,crypto,status}` (forex is served from DB cache —
  users never consume provider quota; crypto is `503` until configured)
- **Admin (JWT, role `admin`/`superadmin`):**
  `POST /api/admin/auth/login`, `GET /api/admin/auth/me`,
  `POST /api/admin/auth/logout`,
  `GET /api/admin/{dashboard,health,users,markets,api-usage,system-logs,audit-logs,settings}`,
  `PATCH /api/admin/users/:id`, `PATCH /api/admin/markets/:id`,
  `POST /api/admin/markets/forex/refresh`,
  `GET /api/admin/{deposits,deposits/:id,withdrawals,withdrawals/:id,transactions,transactions/:id}`,
  `POST /api/admin/{deposits,withdrawals}/:id/{approve,reject}`,
  `GET /api/admin/transactions/export.csv` (capped, same filters as the ledger),
  `GET /api/admin/activity` (admin-scoped feed for the Notifications page),
  `PATCH /api/admin/auth/profile` (own name / password change; audited)
- All errors return JSON `{ error, status, details? }`; auth via `Authorization: Bearer <token>`;
  rate-limited (`RateLimit` headers), Helmet security headers, request validation on bodies.

## Backend design notes

- **Scheduler** (`backend/src/jobs/forexScheduler.js`): one IBRLive request serves all 3 forex
  pairs every 80s (~32,400 requests/month, under the 35,000 limit). Failures never overwrite
  `MarketPrice`; they record a failed `ApiUsage` row + `SystemLog` and mark the provider degraded.
- **Models:** `User`, `Admin`, `Market`, `MarketPrice`, `ApiUsage`, `SystemLog`, `AuditLog`,
  `Wallet`, `Transaction` (deposit/withdrawal ledger with admin review fields),
  `Holding`.
- **Secrets:** API keys are masked in logs and never returned by any endpoint (asserted by tests).

## Admin panel

The admin panel is a **separate Vite app** (`admin/`) — it is never rendered inside
the user frontend. Run it with `npm run dev:admin` and open
**http://localhost:5174/admin** (dev server port 5174; `vite preview` serves the
built panel on 5300). Visiting `/admin` on the user app (5173) forwards to the
admin origin (`VITE_ADMIN_URL`, default `http://localhost:5174` in dev) instead
of showing the user home page.

The panel has URL routes under `/admin/*` (pathname-based, no router
library — same architecture as the mobile frontend). Every route except
`/admin/login` is guarded: a session only exists after `GET /api/admin/auth/me`
succeeds, and the server re-verifies the admin row (existence, `active` status,
role) in the database on **every** privileged request — a valid JWT alone is never
enough. Unknown `/admin/*` paths render an honest 404.

Nav: Dashboard, Users, Deposits, Withdrawals, Transactions, Markets,
Notifications, Audit Logs, Settings, Profile, plus System (API Usage, System
Logs). Notifications is an ADMIN-scoped activity feed (`GET /api/admin/activity`:
pending finance queues, provider health, recent audit entries) — XPO has no
user-notification store and no announcement delivery workflow, so no
announcement composer is offered and nothing is claimed "sent".
Deposits/Withdrawals are admin review queues backed by
`/api/admin/{deposits,withdrawals}` — approve/reject run atomically server-side
(deposit approval credits the wallet exactly once; withdrawal rejection
refunds the reserved amount exactly once) and every decision is written to the
audit trail with the acting admin, reason and outcome. Transactions is the
cross-user ledger with type/status/date filters and a capped CSV export.
Markets shows the full INR-quoted universe (10 forex pairs + 25 cryptos,
including XMR) with last cached price (`—` when unavailable — never a
converted or invented value), provider health, and enable/disable controls.
Profile supports self-service name edit and password change
(`PATCH /api/admin/auth/profile`, current password required, audited; email,
role and status are not self-editable). Audit Logs are append-only — the API
exposes no route to edit or delete them.
Sign-out is confirmed in a dialog, calls
`POST /api/admin/auth/logout` (recorded as `admin.logout` in the audit trail) and
clears the token; any `401` mid-session returns the app to the login screen with
an expiry notice. Layout: desktop sidebar + sticky topbar, mobile off-canvas
drawer. Token is kept in `localStorage` (UX only — never trusted for authz).

## Frontend ↔ backend

The Markets page is driven by static asset metadata (`src/data/cryptoAssets.js` — 24
cryptos, `src/data/forexAssets.js` — 10 INR forex pairs; every pair is quoted against
the Indian Rupee and account money is INR) with live values
supplied by `src/api/marketApi.js` (`fetchMarketData(symbols)`), which is API-ready but
not yet connected to a provider — set `VITE_MARKET_API_URL` (or replace the fetch
inside `marketApi.js`) when one is chosen. Quotes refresh every
`VITE_MARKET_REFRESH_INTERVAL` ms (default `80000`); up/down styling follows the new
price vs the previous one, a failed fetch keeps the last valid price, and rows show
placeholders until the first valid quote — no fabricated prices or `Math.random`.

## Mobile frontend auth

- The app opens on a **Login** page; **Sign up** creates an account via
  `POST /api/auth/register` (password ≥ 8 characters) and signs you in automatically.
- The **Log out** button is on the **Profile** page (Account → Profile) — it clears the
  session and returns to the login screen. Any `401` response does the same.
- Token + profile are stored in `localStorage` (`xpo_token` / `xpo_user`) and sent as
  `Authorization: Bearer <token>`; a stored token is re-validated against
  `GET /api/auth/me` on boot (kept only on network failure so the app stays usable).
- The frontend calls same-origin `/api/*` through the Vite dev/preview proxy
  (`vite.config.js`); set `VITE_API_URL` to point at a remote backend instead.
- Dev test account: `user1@test.com` / `password123`.
- **Dev-only login bypass:** `.env.development` sets `VITE_DEV_AUTH_BYPASS=true`,
  so during local development `/` opens directly on the dashboard while
  `/login` and `/signup` remain reachable by URL (logout and the real login
  flow still work). Any other value — including every `vite build`, which
  never reads `.env.development` — leaves the normal auth flow untouched.
  Implementation: `src/utils/devAuthBypass.js`.

## Tests

```bash
npm run test     # 18 tests: health, auth, RBAC, dashboard, secrets, markets, 404
```

Uses `node --test` against the local dev database; test users are cleaned up after the run.

