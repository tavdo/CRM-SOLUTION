# CRM Solution

Georgian/English CRM workspace with a Bitrix24-inspired dashboard: leads, customers, deals, invoices, tasks, calendar and workspace permissions. Specialist construction workflows remain available through Projects.

See [the contractor implementation and migration guide](docs/CONTRACTOR_IMPLEMENTATION.md) for supported workflows, verification and hosting limitations.

## Omnichannel Inbox

Facebook Messenger, Instagram Direct (Facebook Login), WhatsApp Cloud, and Viber Bot adapters feed the tenant-scoped inbox at `/{locale}/inbox`. Administrators connect accounts at `/{locale}/settings/channels`; managers access their assigned conversations. Messages stay linked through contact merges and lead conversion. The existing web form remains available separately.

Run `npm run db:deploy`, configure the inbox variables in `.env.example`, start Redis with `docker compose -f compose.inbox.yaml up -d`, and run `npm run inbox:worker` alongside `npm run dev`. Optional `npm run inbox:seed` creates a separate **Inbox Sandbox** workspace with disconnected sample channels. Run `npm run test:inbox` for signed payload and tenant-isolation tests.

See [the complete inbox setup and staged manual tests](docs/OMNICHANNEL_INBOX.md) for Meta/Viber onboarding, HTTPS tunnels, media storage, retries, and production requirements. Provider delivery needs real accounts, permissions, credentials, Redis, and a running worker. No live account is connected by installation or seeding.

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

`npm run dev` compiles routes as you visit them and enables hot reload. For a faster local preview, run `npm run build` followed by `npm run start`; rebuild after source changes. Authentication and workspace lookups are deduplicated within each server render, and inbox live updates pause in hidden tabs.

### Workspace accounts

| Workspace | Role | Email | Password |
|---|---|---|---|
| CRM Workspace | Admin | `admin@crm.local` | `Password123!` |
| CRM Workspace | Manager | `manager@crm.local` | `Password123!` |
| CRM Workspace | User | `user@crm.local` | `Password123!` |

The bundled workspace contains exactly one account per role and no sample customers, leads, deals, products, invoices or projects. The starter credentials above are for this shared evaluation workspace. Regular password sign-in works; one-click access stays disabled in production.

Seeding adds missing initial accounts without overwriting changed passwords, roles or existing CRM data. The legacy Alpha/Beta seed has been removed. `npm run db:clean-demo` is an explicit one-time cleanup of the two exact legacy tenants and their six accounts; it requires an explicitly supplied SQLite `DATABASE_URL`, checks dependencies, removes associated local document files and preserves unrelated workspaces. It is never run during request initialization.

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
| `SEED_DEMO_DATA` | `true` to allow the three-account workspace bootstrap; no sample CRM data is generated |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Vitest unit/integration tests |
| `npm run db:seed` | Prepare one empty workspace and three role accounts |
| `npm run db:clean-demo` | Explicitly remove legacy Alpha/Beta demo tenants from a specified SQLite database |
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

Tenant isolation is verified with temporary test workspaces: users cannot read another workspace's record IDs (services return 404/403). Run `node scripts/isolation-smoke.mjs`; it does not depend on seeded CRM records. The development-only `POST /api/dev/isolation-check` helper remains disabled in production.

## Deployment notes

The selected host is Vercel, using the existing GitHub integration for automatic
deployments from `main`. See [Vercel and GitHub operations](docs/VERCEL_GITHUB.md)
for the project, restricted preview configuration and verification steps.

- Bind HTTP to `0.0.0.0:$PORT` on platforms like Render (`next start` respects `PORT`).
- For live hosting use the separate PostgreSQL schema/migrations and `.env.production.example`; follow [the production runbook](docs/PRODUCTION.md). Do not apply SQLite migrations to PostgreSQL.
- Filesystem is ephemeral on many hosts — do not rely on SQLite file persistence there.
- Do not deploy publicly or enable live billing without explicit authorization.

Live releases use `DEPLOYMENT_MODE=live`, `SEED_DEMO_DATA=false`, private S3-compatible
storage and real SMTP. The build selects the Prisma schema from `DATABASE_URL` and
checks live configuration before compiling; migrations are a separate explicit
deployment step. `vercel.json` contains no demo credentials. Starter accounts,
console email and the development billing webhook are blocked for a real release.
Set `INBOX_ENABLED=false` for a CRM pilot without social messaging infrastructure.

Useful launch commands: `npm run test:postgres`, `npm run production:check:live`,
`npm run services:check`, `npm run backup`, `npm run backup:restore` and
`npm run release:smoke -- https://your-domain.ge`. See the runbook for secrets,
domain verification, backup recovery, private storage and free-plan limitations.

## Incomplete / external

- Live payment provider (Stripe) — adapter path only; requires credentials + approved commercial terms.
- SMTP email — console transport works locally; configure `SMTP_*` for real delivery.
- Workspace hard-delete / legal retention policies — documented, not automated.
- Calendar, chat, documents, advanced automation — out of scope for this release.
