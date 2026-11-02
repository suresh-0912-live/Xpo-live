# XPO Project Status

Last reviewed: 2026-11-02 (Asia/Kolkata)

## Baseline before account-recovery work

### Completed features

- User registration, JWT login, protected account/finance APIs, and a React/Vite user app.
- Admin JWT login and protected Admin Panel: dashboard, users, deposits, withdrawals, transactions, markets, provider/usage/system/audit views, profile, and in-app notifications.
- PostgreSQL/Prisma models and migrations for users, wallets, transactions, holdings, admins, market data, notifications, audit logs, and the original password-reset token records.
- Financial review flows keep wallet changes server-side and audited.

### Partially completed features

- Password recovery: admins could issue an expiring recovery token manually and users could redeem it. There was no user "Forgot Password?" request, no security question, no approval/rejection workflow, and no temporary-password login flow.
- Provider integrations and investment execution are scaffolded; external provider configuration is optional and holdings are not executed by the app.

### Pending features at baseline

- Admin-managed forgot-password request and decision workflow.
- Mandatory registration security question and securely stored answer.
- Temporary credential recovery with attempt lockout and session invalidation.

### Database and environment

- Development database is local PostgreSQL `xpo_dev` through `backend/.env`; backend startup rejects non-loopback/non-`xpo_dev` databases outside production.
- `.env.local` contains an unrelated Neon URL, but the backend loads `backend/.env`; no production/Neon database is used for this work.
- Backend: Express 5, Prisma 6, bcrypt, JWT. Frontends: React 19 and Vite.

### Existing APIs and models

- Auth: `/api/auth/register`, `/login`, `/me`, and the original `/password-reset/confirm`.
- Admin recovery: `/api/admin/password-resets` plus list/detail/revoke/delete endpoints.
- Core models: `User`, `Admin`, `Wallet`, `Transaction`, `Holding`, `Market`, `MarketPrice`, `Notification`, `NotificationDelivery`, `AuditLog`, `SystemLog`, `ApiUsage`, and `PasswordReset`.

### Baseline verification

- `npx prisma validate --schema backend/prisma/schema.prisma` completed successfully.
- User and admin Vite build commands were started before implementation; final build/test evidence is recorded below after the scoped change.

## Current implementation status

### Completed in this change

- Registration now requires a security question and answer. Answers are Unicode-normalized, case/whitespace-normalized, then bcrypt-hashed; neither answers nor hashes are returned in public or admin responses.
- User login now provides a visible **Forgot Password?** path. It accepts an email and always responds with the same confirmation message, whether or not an eligible account exists.
- A valid request creates one pending `PasswordReset` recovery record for administrator review. Repeated pending requests do not create duplicates.
- Admin → Password Resets now filters pending/approved/rejected/locked history and lets an admin approve or reject pending requests. Approval generates a five-character mixed letter/number/symbol temporary password, displays it once, and stores only its bcrypt hash.
- Temporary passwords expire after 10 minutes, can begin exactly one recovery session, and do not get consumed by failed password attempts. A successful temporary-password login returns only a short-lived recovery session and the user’s registered question.
- Recovery completion requires the correct security answer and a new 8+ character password. It is concurrency-guarded, single-use, increments the user session version to invalidate existing user JWTs, and invalidates the temporary credential.
- Five incorrect security answers lock that recovery record for administrator intervention. Recovery request/approval/rejection/lock/completion actions are audited without passwords or answers.
- Recovery request and recovery completion endpoints have dedicated 15-minute rate limits; regular authentication throttling remains in place.

### Current recovery APIs

- `POST /api/auth/password-recovery/request` — generic 202 response; creates an eligible user’s pending request.
- `POST /api/admin/password-resets/:id/approve` — admin-only; returns the temporary password once.
- `POST /api/admin/password-resets/:id/reject` — admin-only.
- `POST /api/auth/password-recovery/complete` — requires a short-lived recovery session, security answer, and new password.
- `POST /api/auth/login` — recognizes an approved temporary password and starts the question-verification step; it does not issue a normal user session until recovery completes.

### Database and environment update

- Applied local migrations `20261102170000_admin_managed_password_recovery` and `20261102171500_temporary_password_single_use` to PostgreSQL `xpo_dev` only.
- The migration adds nullable legacy-safe user security-question/hash fields, `sessionVersion`, and recovery lifecycle/approval/lockout fields to `PasswordReset`.
- Prisma Client was regenerated locally. No seed, reset, deletion, or production/Neon operation was performed.

### Verification results

- `backend/tests/recovery.unit.test.js`: **2/2 passing** (normalization and 100 generated mixed temporary passwords). This test does not open or modify `xpo_dev`.
- `prisma validate`: **passed**.
- Backend changed modules: `node --check`: **passed**.
- User frontend production build: **passed**.
- Admin frontend production build: **passed**.
- Existing integration tests were intentionally not run: every existing backend integration suite creates and deletes rows in `xpo_dev`, which conflicts with the instruction not to run tests that modify local records. They were updated where registration/recovery expectations changed, but require an isolated disposable test database before execution.

### Next implementation tasks / manual testing

- Manually exercise the browser flow with a newly registered local-only test account: request → approve → temporary login → answer → permanent login.
- Confirm the admin shares the temporary password only through an approved secure channel.
- Existing pre-security-question accounts cannot submit a recovery request until they set a question through a future authenticated account-security settings flow; this is intentionally non-enumerating and does not expose an answer to an admin.
- Run the full backend integration suite only against an isolated disposable PostgreSQL database, never the shared `xpo_dev` data.
