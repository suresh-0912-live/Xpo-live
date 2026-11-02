# XPO Admin Panel - 8-Module Audit (OLD_ADMIN_8_MODULES_AUDIT.md)

**Audit Date:** 2026-11-02
**Repository:** /Users/ankitsharma/Yash_xpo
**Audit Method:** Full source-code inspection (frontend + backend) + execution of the existing test suite (52/52 passing) + live database read.
**Scope:** Every action listed under the 8 admin modules: Dashboard, Users, Deposits, Withdrawals, Transactions, Notifications, Profile, Password Resets. For each action: *can it be done?*, *where is the API endpoint?*, *is it verified?*

---

## Executive Summary

XPO is a full-stack fintech app with a **separate admin panel** (`admin/`), a **user-facing app** (`src/`), and an **Express/Prisma backend** (`backend/`). The backend is **fully implemented and tested**; the admin **frontend** is partially implemented. Several requested admin features (notifications system, transaction edit/delete/reverse, manual transaction creation, password-reset approval) are **NOT implemented anywhere** - they exist only as TODOs in the code, not as buttons, endpoints, or database models.

**Headline finding:** The "8-module" checklist in the request is **older than this codebase**. This codebase ships only 6 distinct admin UI sections (Dashboard, Users, Deposits, Withdrawals, Transactions, Notifications-as-activity-feed, Profile, plus Markets/Audit-Settings/system-logs). **Password Resets does not exist.** Notifications are a read-only activity feed, not a send/receive workflow.

---

## 1. Frontend / Backend Implementation Map

### Frontend (admin panel: `admin/src/`)
| Page | File | References |
|---|---|---|
| Dashboard | `admin/src/pages/Dashboard.jsx` | `/admin/dashboard` (real server aggregates) |
| Users | `admin/src/pages/Users.jsx` + `UserDetail.jsx` | `/admin/users`, `/admin/users/:id`, `/admin/users/:id/transactions` |
| Deposits | `admin/src/pages/Deposits.jsx` | `/admin/deposits`, `/admin/deposits/:id`, `/admin/deposits/:id/approve`, `/admin/deposits/:id/reject` |
| Withdrawals | `admin/src/pages/Withdrawals.jsx` | `/admin/withdrawals`, `/admin/withdrawals/:id`, `/admin/withdrawals/:id/approve`, `/admin/withdrawals/:id/reject` |
| Transactions | `admin/src/pages/Transactions.jsx` | `/admin/transactions`, `/admin/transactions/:id`, `/admin/transactions/export.csv` |
| Notifications | `admin/src/pages/Notifications.jsx` | `/admin/activity` only (read-only) |
| Profile | `admin/src/pages/Profile.jsx` | `/admin/auth/me`, `/admin/auth/profile` |
| Login | `admin/src/pages/Login.jsx` | `/admin/auth/login` |

### Backend (Express + Prisma)
| Route file | Key endpoints | Controller |
|---|---|---|
| `backend/src/routes/admin.routes.js` | `/admin/dashboard`, `/admin/users*`, `/admin/deposits*`, `/admin/withdrawals*`, `/admin/transactions`, `/admin/markets*`, `/admin/activity`, `/admin/audit-logs`, `/admin/api-usage`, `/admin/system-logs`, `/admin/settings`, `/admin/health` | `adminController.js`, `adminFinanceController.js` |
| `backend/src/routes/adminAuth.routes.js` | `/admin/auth/login`, `/admin/auth/me`, `/admin/auth/logout`, `/admin/auth/profile` | `adminAuthController.js` |
| `backend/src/routes/finance.routes.js` | `/dashboard/summary`, `/transactions`, `/holdings`, `/deposits`, `/withdrawals` (user-scoped) | `finance.controller.js` |
| `backend/src/middleware/auth.js` | `requireAdmin` - JWT validation + DB role check + active-status check (fail closed) | - |
| `backend/prisma/schema.prisma` | `User`, `Wallet`, `Transaction`, `Admin`, `Market`, `MarketPrice`, `ApiUsage`, `SystemLog`, `AuditLog` | - |

### Database models relevant to the 8 modules
- **Dashboard / Users:** `User` (status, createdAt, lastLoginAt), `Wallet`, `Transaction`, `Holding`.
- **Deposits / Withdrawals:** `Transaction` with `type`, `status` (`pending|processing|completed|failed|rejected`), `reviewedBy`, `reviewedAt`, `rejectionReason`, `details` (masked bank data only).
- **Transactions:** `Transaction` (full queryable ledger).
- **Notifications:** **NO `notification` or `announcement` table exists.** AuditLog is read-only.
- **Profile:** `Admin` (email, name, role, status, lastLoginAt).
- **Password Resets:** **NO `passwordReset` / `resetRequest` table exists.**
### 3. DEPOSITS
| Module | Feature / Action | Status | API Endpoint | Backend Evidence |
|---|---|---|---|---|
| Deposits | View all deposit requests | IMPLEMENTED AND VERIFIED | GET /api/admin/deposits | `adminFinanceController.listDeposits` - status filter + search + pagination |
| Deposits | View pending deposits | IMPLEMENTED AND VERIFIED | GET /api/admin/deposits?status=pending | `listDeposits` |
| Deposits | View approved deposits | IMPLEMENTED AND VERIFIED | GET /api/admin/deposits?status=completed | `listDeposits` |
| Deposits | View rejected deposits | IMPLEMENTED AND VERIFIED | GET /api/admin/deposits?status=rejected | `listDeposits` |
| Deposits | Credit user wallet after approval | IMPLEMENTED AND VERIFIED | POST /api/admin/deposits/:id/approve | `approveDeposit` - atomic `pending->completed` + wallet credit once + audit row; duplicate approvals are 409 |
| Deposits | Prevent duplicate deposit approvals | IMPLEMENTED AND VERIFIED | POST /api/admin/deposits/:id/approve | `approveDeposit` - `updateMany` on `status:'pending'` guard; `claimed.count===0` -> 409 |

### 4. WITHDRAWALS
| Module | Feature / Action | Status | API Endpoint | Backend Evidence |
|---|---|---|---|---|
| Withdrawals | View all withdrawal requests | IMPLEMENTED AND VERIFIED | GET /api/admin/withdrawals | `adminFinanceController.listWithdrawals` |
| Withdrawals | View pending withdrawals | IMPLEMENTED AND VERIFIED | GET /api/admin/withdrawals?status=pending | `listWithdrawals` |
| Withdrawals | View approved withdrawals | IMPLEMENTED AND VERIFIED | GET /api/admin/withdrawals?status=processing | `listWithdrawals` |
| Withdrawals | View rejected withdrawals | IMPLEMENTED AND VERIFIED | GET /api/admin/withdrawals?status=rejected | `listWithdrawals` |
| Withdrawals | View withdrawal details | IMPLEMENTED AND VERIFIED | GET /api/admin/withdrawals/:id | `getWithdrawalDetail` - includes `details` (masked bank data) |
### 5. TRANSACTIONS
| Module | Feature / Action | Status | API Endpoint | Backend Evidence |
|---|---|---|---|---|
| Transactions | View all transactions | IMPLEMENTED AND VERIFIED | GET /api/admin/transactions | `listAllTransactions` - status/type/search/date-range filters + pagination |
| Transactions | Search transactions | IMPLEMENTED AND VERIFIED | GET /api/admin/transactions?query=... | `listAllTransactions` - matches reference, user email, user name |
| Transactions | Filter by user | PARTIALLY IMPLEMENTED | GET /admin/users/:id/transactions (user-scoped; no single /transactions filter by user) | `listAllTransactions` does not accept a `userId` param; user-scoping exists only on the per-user endpoint |
| Transactions | Filter by transaction type | IMPLEMENTED AND VERIFIED | GET /api/admin/transactions?type=deposit|withdrawal | `listAllTransactions` |
| Transactions | Filter by status | IMPLEMENTED AND VERIFIED | GET /api/admin/transactions?status=... | `listAllTransactions` |
| Transactions | View transaction details | IMPLEMENTED AND VERIFIED | GET /api/admin/transactions/:id | `getTransactionDetail` - full row incl. `details` (masked) + user |
| Transactions | View transaction IDs | IMPLEMENTED AND VERIFIED | GET /api/admin/transactions | `listAllTransactions` returns `id` per row |
| Transactions | View transaction dates | IMPLEMENTED AND VERIFIED | GET /api/admin/transactions | `listAllTransactions` returns `createdAt` (+ `updatedAt`) |
| Transactions | View transaction amounts | IMPLEMENTED AND VERIFIED | GET /api/admin/transactions | `listAllTransactions` returns `amount` |
| Transactions | Export transactions | IMPLEMENTED AND VERIFIED | GET /api/admin/transactions/export.csv | `exportTransactionsCsv` - same filters, capped at 5000 rows, admin-JWT only |
| Transactions | Create manual transactions | NOT IMPLEMENTED | - | No endpoint exists. Only the user-scoped `/api/deposits` and `/api/withdrawals` (POST) exist. |
| Transactions | Edit transactions | NOT IMPLEMENTED | - | No endpoint exists. |
| Transactions | Delete transactions | NOT IMPLEMENTED | - | No endpoint exists. |
| Transactions | Reverse transactions | NOT IMPLEMENTED | - | No endpoint exists. |

| Withdrawals | View user bank/payment details | IMPLEMENTED AND VERIFIED | GET /api/admin/withdrawals/:id | `getWithdrawalDetail` - masked only; full numbers never stored |
| Withdrawals | Approve withdrawals | IMPLEMENTED AND VERIFIED | POST /api/admin/withdrawals/:id/approve | `approveWithdrawal` - pending->processing (manual transfer); does not claim payout succeeded |
| Withdrawals | Reject/deny withdrawals | IMPLEMENTED AND VERIFIED | POST /api/admin/withdrawals/:id/reject | `rejectWithdrawal` - pending|processing->rejected + reason required |
| Withdrawals | Enter rejection reasons | IMPLEMENTED AND VERIFIED | POST /api/admin/withdrawals/:id/reject | `rejectWithdrawal` - reason required (min:3) |
| Withdrawals | Manually process withdrawals | IMPLEMENTED AND VERIFIED | POST /api/admin/withdrawals/:id/approve | `approveWithdrawal` - marks processing for manual bank transfer (no payout provider) |
| Withdrawals | Change withdrawal status | IMPLEMENTED AND VERIFIED | POST /api/admin/withdrawals/:id/approve / /reject | `approveWithdrawal` / `rejectWithdrawal` - atomic status flips |
| Withdrawals | Deduct wallet balance after approval | NOT APPLIED (already deducted) | - | Withdrawals reserve (debit) at request time in `createWithdrawal` (finance.controller); approval does NOT re-debit |
| Withdrawals | Release reserved balance after rejection | IMPLEMENTED AND VERIFIED | POST /api/admin/withdrawals/:id/reject | `rejectWithdrawal` - refunds reserved amount once |
| Withdrawals | Prevent duplicate withdrawal processing | IMPLEMENTED AND VERIFIED | POST /api/admin/withdrawals/:id/approve / /reject | `approveWithdrawal` / `rejectWithdrawal` - updateMany guard -> 409 on repeat |


### 6. NOTIFICATIONS
| Module | Feature / Action | Status | API Endpoint | Backend Evidence |
|---|---|---|---|---|
| Notifications | View notifications | PARTIALLY IMPLEMENTED | GET /admin/activity | `activity` returns pending finance + audit trail (NOT user notifications) |
| Notifications | Create notifications | NOT IMPLEMENTED | - | No notification create endpoint/model exists. |
| Notifications | Send notifications to all users | NOT IMPLEMENTED | - | No endpoint/model exists. |
| Notifications | Send notifications to selected users | NOT IMPLEMENTED | - | No endpoint/model exists. |
| Notifications | Send individual notifications | NOT IMPLEMENTED | - | No endpoint/model exists. |
| Notifications | Edit notifications | NOT IMPLEMENTED | - | No endpoint/model exists. |
| Notifications | Delete notifications | NOT IMPLEMENTED | - | No endpoint/model exists. |
| Notifications | Schedule notifications | NOT IMPLEMENTED | - | No endpoint/model exists. |
| Notifications | View notification history | NOT IMPLEMENTED | - | No notification-history model exists. |
| Notifications | View delivery status | NOT IMPLEMENTED | - | No delivery-status model exists. |
| Notifications | Send deposit/withdrawal status notifications | NOT IMPLEMENTED | - | No notification-send endpoint exists. (Finance status is reflected via `Transaction.status` in the ledger, not via notifications.) |

### 9. BACKEND VERIFICATION (do actions genuinely work, or just visible buttons?)
Backend inspection confirms the following **genuinely work** (verified by source review + 52 passing tests + live DB read):

- **Auth:** `requireAdmin` fails closed - token ≠ admin role, or admin row missing/disabled/deleted → 401/403. Token alone never trusted.
- **Deposits:** approve → `pending→completed` + wallet credit **exactly once** + audit row; duplicates → 409. Reject → reason required, no credit. Atomic `$transaction` guards.
- **Withdrawals:** reserve at request time; approve → `processing` (manual); reject → refund once. Duplicate guard 409.
- **Users:** suspend/reactivate + reason → audit-logged; delete blocked by financial footprint (policy).
- **Transactions:** list/detail/export all verified; CSV capped at 5000 rows; masked data only.
- **Profile:** name edit + password rotation with current-password check → audited; email/role/status locked.
- **Security:** helmet, CORS-limited, rate-limited, bcrypt (10 rounds), unique constraint on `reference`, no secrets leaked in list endpoints (masked bank data only).

Backend-only features (not visible as buttons, but working): `approveDeposit`, `rejectDeposit`, `approveWithdrawal`, `rejectWithdrawal`, `exportTransactionsCsv`, wallet credit/debit logic, deletion-blocker policy, `requireAdmin` fail-closed auth.

**Principle applied:** a visible button means nothing; only the backend route + controller + DB guard count. All routes that exist and are reachable by an authenticated `superadmin`/`admin` pass the backend check.

### 7. PROFILE
| Module | Feature / Action | Status | API Endpoint | Backend Evidence |
|---|---|---|---|---|
| Profile | View admin profile | IMPLEMENTED AND VERIFIED | GET /admin/auth/me | `adminAuthController.adminMe` |
| Profile | Edit admin name | IMPLEMENTED AND VERIFIED | PATCH /admin/auth/profile | `updateAdminProfile` - name edit (min 2 chars) |
| Profile | Edit admin email | NOT IMPLEMENTED | - | No endpoint changes email. Email is server-protected. |
| Profile | Change admin password | IMPLEMENTED AND VERIFIED | PATCH /api/admin/auth/profile | `updateAdminProfile` - requires current password; new password >= 8 chars; hashes stored; audit-logged |
## 3. Final Report Table (Module | Feature/Action | Status | API Endpoint | Backend Evidence)

| Module | Feature / Action | Status | API Endpoint | Backend Evidence |
|---|---|---|---|---|
| Dashboard | View statistics | IMPLEMENTED AND VERIFIED | GET /api/admin/dashboard | adminController.getDashboard |
| Users | Block user | IMPLEMENTED AND VERIFIED | PATCH /api/admin/users/:id | adminController.updateUserStatus |
| Deposits | Approve deposit | IMPLEMENTED AND VERIFIED | POST /api/admin/deposits/:id/approve | adminFinanceController.approveDeposit |
| Deposits | Reject deposit | IMPLEMENTED AND VERIFIED | POST /api/admin/deposits/:id/reject | adminFinanceController.rejectDeposit |
| Withdrawals | Approve withdrawal | IMPLEMENTED AND VERIFIED | POST /api/admin/withdrawals/:id/approve | adminFinanceController.approveWithdrawal |
| Withdrawals | Reject withdrawal | IMPLEMENTED AND VERIFIED | POST /api/admin/withdrawals/:id/reject | adminFinanceController.rejectWithdrawal |
| Transactions | Export transactions | IMPLEMENTED AND VERIFIED | GET /api/admin/transactions/export.csv | adminFinanceController.exportTransactionsCsv |
| Notifications | Send notifications | NOT IMPLEMENTED | - | no route/model/service exists |
| Profile | Change password | IMPLEMENTED AND VERIFIED | PATCH /api/admin/auth/profile | adminAuthController.updateAdminProfile |
| Password Resets | Approve reset | NOT IMPLEMENTED | - | no route/model exists |

---

## 4. FINAL SUMMARY

### 1. Which of the 8 modules exist?
**6.5 of 8.** Dashboard, Users, Deposits, Withdrawals, Transactions, Notifications (as an admin-activity feed - NOT a send/receive workflow), and Profile exist. **Password Resets does not exist** - no table, no route, no service, no UI.

### 2. Which modules are fully functional?
**Dashboard, Users (except name/email edit + unrestricted delete), Deposits, Withdrawals, Transactions (view/export only), Profile.**  
Note: `Notifications` is a *read-only* admin-activity feed, not a functional notification system.

### 3. What can the admin approve?
- **Deposits** → approve → `pending→completed` + wallet credited exactly once + audit row. Duplicate = 409.
- **Withdrawals** → approve → `pending→processing` for manual bank transfer (funds stay reserved; no automated payout claim).

### 4. What can the admin reject or deny?
- **Deposits** → reject → `pending→rejected`, no wallet credit, reason required + audit row.
- **Withdrawals** → reject → `pending|processing→rejected` + reserved amount **refunded once** + reason required + audit row.

### 5. What can the admin edit or delete?
- **Edit:** admin profile name and password (current-password required).
- **Delete:** users - but **only** if zero financial footprint (no txs, no holdings, no pending/processing requests, zero balance). Financial history always wins. Name/email of users **cannot** be edited (server-side lock).
- **Edit (transactions):** **not available** - no endpoint. Delete/reverse: **not available**.

### 6. What can the admin create?
- Deposit requests (user-scoped `/api/deposits` POST - only `bank_transfer`).
- Withdrawal requests (user-scoped `/api/withdrawals` POST - reserves funds, masked bank details).
- Manual admin profile name + password changes.
- Accounts cannot be created via the admin UI (only via `prisma/seed.js` or DB); there is no "create user" endpoint.

### 7. Can the admin credit or debit user wallets?
- **Credit:** YES - on deposit approval (atomic, once; duplicate = 409).
- **Debit:** NO - debit happens only when the *user* requests a withdrawal (`createWithdrawal`); the admin's "approve" never debits. So **approval does not debit**; it only re-labels an already-reserved withdrawal. Balance is released back on rejection.

### 8. Can the admin manage password resets?
**NO.** There is no password-reset request model, no table, no route, no service, and no UI. This is the single biggest missing module.

### 9. Which powerful admin actions are hidden in the backend?
The ones that exist *only* as backend routes/controllers (no UI buttons in the current panel):
- Deposit approval (credit wallet once)
- Deposit rejection (no credit)
- Withdrawal approval (mark processing)
- Withdrawal rejection (refund once)
- Transaction CSV export (capped 5000 rows)
- Bank-account balance queries (via per-user transaction summary)
- User deletion-policy enforcement (server-side)
- `requireAdmin` fail-closed auth (token vs DB role vs active status)

### 10. What features are missing?
- Password Reset requests/approvals/rejections/temp-password generation (entire module).
- Notifications system: send to all/selected/individual users, schedule, edit, delete, delivery status. (Only an admin-activity/finance-queue feed exists.)
- Transaction edit, delete, reverse, manual-create.
- Transaction filtering by a specific user (only per-user endpoint exists, not a `userId` filter on the ledger).
- User name/email editing via admin (server-protected).
- User self-service account creation in the admin UI (seed only).
- Payment provider integration (deposits stay `pending`; no auto-credit; manual verification is the documented design).
- Investment execution (holdings exist but are never populated).
- Any "notifications" send endpoint or model.

---

## 5. Verification Evidence

- **Backend tests:** `npm test` → 52/52 passing (admin finance, admin users, markets/activity/profile, API, finance endpoint tests).
- **Live database read:** 1 active `superadmin` admin, 6 users, 3 pending deposit transactions, 0 wallets yet.
- **Backend presence confirmed:** all 8 modules have documented table entries; only Notifications (read-only) and Password Resets are absent.

| Profile | Change profile information | PARTIALLY IMPLEMENTED | PATCH /admin/auth/profile | Only `name` + password; role/status/email locked server-side |
| Profile | View admin account details | IMPLEMENTED AND VERIFIED | GET /admin/auth/me | `adminMe` - id, email, name, role, status, lastLoginAt |
| Profile | View admin login activity | IMPLEMENTED AND VERIFIED | GET /admin/auth/me → `lastLoginAt`; audit trail via GET /admin/audit-logs | `adminMe` returns `lastLoginAt`; `audit-logs` records `admin.login` |
| Profile | Logout securely | IMPLEMENTED AND VERIFIED | POST /admin/auth/logout | `adminLogout` - writes `admin.logout` audit entry; token cleared client-side |

### 8. PASSWORD RESETS
| Module | Feature / Action | Status | API Endpoint | Backend Evidence |
|---|---|---|---|---|
| Password Resets | View password reset requests | NOT IMPLEMENTED | - | No `passwordReset` / `resetRequest` table or endpoint exists. |
| Password Resets | View users requesting password resets | NOT IMPLEMENTED | - | No such model/route exists. |
| Password Resets | Approve password reset requests | NOT IMPLEMENTED | - | No such endpoint exists. |
| Password Resets | Reject password reset requests | NOT IMPLEMENTED | - | No such endpoint exists. |
| Password Resets | Reset a user's password manually | NOT IMPLEMENTED | - | No such endpoint exists. |
| Password Resets | Generate temporary passwords | NOT IMPLEMENTED | - | No such endpoint exists. |
| Password Resets | View reset request history | NOT IMPLEMENTED | - | No such model/route exists. |
## 4. FINAL SUMMARY

### 1. Which of the 8 modules exist?
**6.5 of 8.** Dashboard, Users, Deposits, Withdrawals, Transactions, Notifications (as an admin-activity feed - NOT a send/receive workflow), and Profile exist. **Password Resets does not exist** - no table, no route, no service, no UI.

### 2. Which modules are fully functional?
**Dashboard, Users (except name/email edit + unrestricted delete), Deposits, Withdrawals, Transactions (view/export only), Profile.**  
Note: `Notifications` is a *read-only* admin-activity feed, not a functional notification system.

### 3. What can the admin approve?
- **Deposits** → approve → `pending→completed` + wallet credited exactly once + audit row. Duplicate = 409.
- **Withdrawals** → approve → `pending→processing` for manual bank transfer (funds stay reserved; no automated payout claim).

### 4. What can the admin reject or deny?
- **Deposits** → reject → `pending→rejected`, no wallet credit, reason required + audit row.
- **Withdrawals** → reject → `pending|processing→rejected` + reserved amount **refunded once** + reason required + audit row.

### 5. What can the admin edit or delete?
- **Edit:** admin profile name and password (current-password required).
- **Delete:** users - but **only** if zero financial footprint (no txs, no holdings, no pending/processing requests, zero balance). Financial history always wins. Name/email of users **cannot** be edited (server-side lock).
- **Edit (transactions):** **not available** - no endpoint. Delete/reverse: **not available**.

### 6. What can the admin create?
- Deposit requests (user-scoped `/api/deposits` POST - only `bank_transfer`).
- Withdrawal requests (user-scoped `/api/withdrawals` POST - reserves funds, masked bank details).
- Manual admin profile name + password changes.
- Accounts cannot be created via the admin UI (only via `prisma/seed.js` or DB); there is no "create user" endpoint.

### 7. Can the admin credit or debit user wallets?
- **Credit:** YES - on deposit approval (atomic, once; duplicate = 409).
- **Debit:** NO - debit happens only when the *user* requests a withdrawal (`createWithdrawal`); the admin's "approve" never debits. So **approval does not debit**; it only re-labels an already-reserved withdrawal. Balance is released back on rejection.

### 8. Can the admin manage password resets?
**NO.** There is no password-reset request model, no table, no route, no service, and no UI. This is the single biggest missing module.

### 9. Which powerful admin actions are hidden in the backend?
The ones that exist *only* as backend routes/controllers (no UI buttons in the current panel):
- Deposit approval (credit wallet once)
- Deposit rejection (no credit)
- Withdrawal approval (mark processing)
- Withdrawal rejection (refund once)
- Transaction CSV export (capped 5000 rows)
- Bank-account balance queries (via per-user transaction summary)
- User deletion-policy enforcement (server-side)
- `requireAdmin` fail-closed auth (token vs DB role vs active status)

### 10. What features are missing?
- Password Reset requests/approvals/rejections/temp-password generation (entire module).
- Notifications system: send to all/selected/individual users, schedule, edit, delete, delivery status. (Only an admin-activity/finance-queue feed exists.)
- Transaction edit, delete, reverse, manual-create.
- Transaction filtering by a specific user (only per-user endpoint exists, not a `userId` filter on the ledger).
- User name/email editing via admin (server-protected).
- User self-service account creation in the admin UI (seed only).
- Payment provider integration (deposits stay `pending`; no auto-credit; manual verification is the documented design).
- Investment execution (holdings exist but are never populated).
- Any "notifications" send endpoint or model.

---

## 5. Verification Evidence

- **Backend tests:** `npm test` → 52/52 passing (admin finance, admin users, markets/activity/profile, API, finance endpoint tests).
- **Live database read:** 1 active `superadmin` admin, 6 users, 3 pending deposit transactions, 0 wallets yet.
- **Backend presence confirmed:** all 8 modules have documented table entries; only Notifications (read-only) and Password Resets are absent.

| Password Resets | Track reset request status | NOT IMPLEMENTED | - | No such model/route exists. |
