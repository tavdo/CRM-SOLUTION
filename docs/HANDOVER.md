# CRM Solution — Handover

## Implemented

- Multi-tenant workspaces with company isolation on every CRM query
- Sign-up / sign-in / sign-out / password reset / email verification (console email in dev)
- Employee invitations (expiring, single-use, role fixed server-side)
- Roles: Admin, Manager, Employee (matrix in `src/lib/permissions.ts`)
- Workspace switcher for multi-membership accounts
- Customers, contacts, notes, archive, search, pagination, custom fields (text/number/date/select)
- Deals board + list, stage moves, won/lost, activity history, accurate minor-unit money
- Configurable pipeline stages (delete requires move target)
- Tasks with assignee, due dates, overdue rules, links to customers/deals
- Dashboard from live data with metric definitions
- Company settings, members, subscription plan catalog + status + limits
- Dev billing webhook with signature verification + duplicate protection
- Full EN / KA UI via next-intl; language preference stored on user
- Audit events for important changes (no secrets)
- Seed data for two companies and three roles each
- Health check at `/api/health`

## Setup

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Demo login: `admin@demo-alpha.local` / `Password123!`

## Verification that ran

| Check | Result |
|---|---|
| `npm run lint` | Pass (after fixes) |
| `npm run typecheck` | Pass |
| `npm test` (12 tests) | Pass |
| `npm run build` | Pass |
| Browser smoke: sign-in, dashboard, customers, deals board, KA locale | Pass |
| Tenant cross-lookup script | `crossTenantLookup: blocked` |

## Externally blocked / not production-activated

- Live Stripe (or other) payments — requires owner credentials and approved prices
- Real SMTP — configure `SMTP_*` or keep `EMAIL_TRANSPORT=console`
- Public deploy — not performed
- Legal retention / workspace hard-delete policy — documented, not automated

## Assumptions (reversible)

- Local DB is SQLite; production should switch Prisma provider to PostgreSQL
- Default timezone `Asia/Tbilisi`, currency `GEL`
- Plan prices in seed are **placeholders**, not commercial terms
- Employees see only records they own; managers/admins see all workspace CRM data
