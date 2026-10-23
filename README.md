# CRM Solution

Multi-tenant subscription CRM (English + Georgian) for the first usable release: workspaces, roles, customers, deals pipeline, tasks, dashboard, and subscription foundations.

## Stack

Next.js 15 · TypeScript · Prisma · SQLite (local) · next-intl · cookie sessions

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, permission matrix, and tenancy rules.

## Quick start

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open [http://localhost:3000/en](http://localhost:3000/en).

### Demo accounts (local seed only)

| Workspace | Role | Email | Password |
|---|---|---|---|
| Demo Alpha | Admin | `admin@demo-alpha.local` | `Password123!` |
| Demo Alpha | Manager | `manager@demo-alpha.local` | `Password123!` |
| Demo Alpha | Employee | `employee@demo-alpha.local` | `Password123!` |
| დემო ბეტა | Admin | `admin@demo-beta.local` | `Password123!` |
| დემო ბეტა | Manager | `manager@demo-beta.local` | `Password123!` |
| დემო ბეტა | Employee | `employee@demo-beta.local` | `Password123!` |

Seed records are labeled **DEMO** / **DEMO-ALPHA** / **DEMO-BETA**.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma DB URL (`file:./dev.db` locally) |
| `SESSION_SECRET` | Session hardening secret (32+ chars) |
| `APP_URL` | Base URL for invite/reset/verify links |
| `EMAIL_TRANSPORT` | `console` (default) or `smtp` |
| `SMTP_*` | SMTP settings when not using console |
| `BILLING_PROVIDER` | `dev` (default). Stripe not activated |
| `BILLING_WEBHOOK_SECRET` | HMAC secret for `/api/billing/webhook` |
| `SEED_DEMO_DATA` | `true` to allow demo seed |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Vitest unit/integration tests |
| `npm run db:seed` | Seed plans + two demo companies |
| `npm run setup` | Migrate + seed |

## Core workflow (admin walkthrough)

1. Sign in as `admin@demo-alpha.local` (or register a new workspace at `/en/sign-up`).
2. Open **Customers** → create or open a customer → add a contact and note.
3. Open **Sales** → create a deal linked to the customer → move stages on the board.
4. From the deal, create a follow-up **Task** with a due date.
5. Complete the task; mark the deal **Won** or **Lost** (loss requires a reason).
6. Check **Dashboard** summaries (active deals, pipeline by currency, overdue tasks).
7. In **Settings**, invite an employee (link appears in the server console), adjust stages/fields, review subscription (dev adapter).

## Billing (dev adapter)

```bash
# Example signed webhook (PowerShell-friendly: use node)
node -e "const c=require('crypto');const b=JSON.stringify({id:'evt_demo_1',type:'subscription.activated',companyId:'YOUR_COMPANY_ID'});console.log(c.createHmac('sha256',process.env.BILLING_WEBHOOK_SECRET||'dev-webhook-secret').update(b).digest('hex'));console.log(b)"
```

`POST /api/billing/webhook` with header `x-billing-signature: <hex>`. Duplicate `id` values are ignored safely. Live Stripe activation needs owner credentials and approved prices — not enabled by default.

## Health

`GET /api/health`

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tenant isolation: after seeding two companies, signed-in Alpha users must not read Beta record IDs (services return 404/403). Dev helper: `POST /api/dev/isolation-check` with `{ "customerId": "<beta-id>" }` (disabled in production).

## Deployment notes

- Bind HTTP to `0.0.0.0:$PORT` on platforms like Render (`next start` respects `PORT`).
- Use PostgreSQL in production (`provider = "postgresql"` in Prisma + migrate).
- Filesystem is ephemeral on many hosts — do not rely on SQLite file persistence there.
- Do not deploy publicly or enable live billing without explicit authorization.

## Incomplete / external

- Live payment provider (Stripe) — adapter path only; requires credentials + approved commercial terms.
- SMTP email — console transport works locally; configure `SMTP_*` for real delivery.
- Workspace hard-delete / legal retention policies — documented, not automated.
- Calendar, chat, documents, advanced automation — out of scope for this release.
