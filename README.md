# CRM Solution

Georgian/English workspace for construction contractors: inquiries, visits and offers, projects, versioned estimates, planned/actual budgets, site reports, materials, purchasing, subcontractors, acceptance acts and manual payments.

See [the contractor implementation and migration guide](docs/CONTRACTOR_IMPLEMENTATION.md) for supported workflows, verification and hosting limitations.

## Stack

Next.js 15 · TypeScript · Prisma · SQLite (local) · next-intl · cookie sessions

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, permission matrix, and tenancy rules.

## Quick start

```bash
cp .env.example .env
npm install
npm run db:deploy
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

Seed records are labeled **DEMO** / **DEMO-ALPHA** / **DEMO-BETA**. Seeding is additive: existing records are preserved. Four contractor projects are added only to the two known demo tenants.

For an existing database, back it up and run `npm run db:deploy` before starting this version. Never use a reset to install this change.

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

1. Add a **Client** and capture an incoming request; arrange a site visit and offer.
2. Mark the agreed order **Won** and choose **Create from agreed order**, or add a **Project** directly.
3. In the project, prepare an **Estimate**, add decimal quantities and cost categories, then approve a version.
4. Assign **Site work** and record daily completed quantities, issues and private photos.
5. Request **Materials**, compare supplier quotes, approve an order, receive quantities, use/return/transfer stock.
6. Agree **Subcontractor** work, confirm completed volume and allocate manual payments.
7. Create an **Acceptance act**, record client confirmation, generate its linked draft invoice and record receipts/outflows.
8. Review **Budget** and the construction **Dashboard**, resolve issues, then mark the project handed over.

Financial access is separate from project access. Employees see assigned projects and operational quantities; administrators/managers handle project finance. Payments and client confirmations are manual records, without bank verification or electronic signatures.

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
