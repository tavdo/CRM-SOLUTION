# CRM Solution — Architecture

## Stack decision

- **Next.js 15 (App Router) + TypeScript** — typed full-stack UI and server actions in one deployable app.
- **Prisma + SQLite (local) / Postgres-ready schema** — relational multi-tenant model with migrations. Local SQLite removes Docker as a setup blocker; production should use PostgreSQL via `DATABASE_URL`.
- **Cookie sessions** (hashed tokens in DB) — revocable sessions, no JWT-only auth.
- **next-intl** — English and Georgian UI strings with locale-prefixed routes (`/en`, `/ka`).
- **Zod** — request validation at action boundaries.
- **Dev email console transport** — invitation/reset/verify links printed to the server log.

## Multi-tenancy

Every CRM record carries `companyId`. Services always query with the active workspace id from the membership-checked session. Cross-company foreign keys are rejected by looking up related rows with `companyId` before linking. Employees only see records they own unless they have `crm.all` (managers/admins).

## Identity and membership

- `User` is global identity (email + password).
- `Membership` binds a user to a `Company` with role `ADMIN | MANAGER | EMPLOYEE`.
- Workspace switcher stores `crm_workspace` cookie; membership is re-checked on every request.
- Invitations are single-use, expiring, email-bound, and carry the role (no client-side escalation).
- Last administrator cannot be removed or demoted.

## Permission matrix

Documented in `src/lib/permissions.ts` and enforced in services (not only UI).

| Capability | Admin | Manager | Employee |
|---|---|---|---|
| Company settings, members, pipeline, fields, billing | ✓ | | |
| All CRM records + assign owners | ✓ | ✓ | |
| Create CRM records; access own assignments | ✓ | ✓ | ✓ |

## Domain model

- **Customers / Contacts / Notes / Custom fields**
- **Pipeline stages + Deals** (amount as integer minor units; totals by currency, no FX)
- **Tasks** (overdue = OPEN and `dueAt` < now)
- **Audit events** (no secrets)
- **Plans / Subscriptions / Billing events** (dev webhook adapter; Stripe path reserved)

## Subscription behaviour

- New workspaces start `TRIALING` with configurable trial days from `Plan`.
- `PAST_DUE` / `CANCELED` / `EXPIRED` never delete CRM data.
- Plan limits for users/customers/deals enforced server-side.
- Billing webhook verifies HMAC signature and ignores duplicate `externalEventId`s.

## Dates and locales

- Stored in UTC.
- Displayed with company timezone.
- UI language is independent of customer record language (Unicode preserved; no auto-translate).

## Data retention (policy decisions pending)

- Soft-archive for customers/deals/stages/fields (`archivedAt`).
- Hard deletion of a workspace is not automated in v1 — requires an explicit owner decision and legal review.
- Do not treat this document as a compliance claim.

## Backup / restore (local)

```bash
# Backup SQLite file
cp prisma/dev.db backups/dev-$(date +%Y%m%d).db

# Restore
cp backups/dev-YYYYMMDD.db prisma/dev.db
```

For PostgreSQL in production, use managed backups / `pg_dump`.
