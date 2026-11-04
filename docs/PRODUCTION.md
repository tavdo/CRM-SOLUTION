# Production path (beyond the Vercel SQLite demo)

The public Vercel demo uses **ephemeral SQLite** under `/tmp` plus console email. That is fine for a portfolio. For a real Georgian SMB tenant, switch both.

## Vercel demo schema preparation

The Vercel build runs `npm run build:vercel`, which generates Prisma, then runs `scripts/prepare-demo-db.mjs --vercel` before Next.js. The explicit flag ensures preparation runs even when Vercel system variables are not exposed during the build. For the Vercel SQLite demo only, preparation copies the tracked `prisma/demo-seed.db` to the packaged `prisma/deployment-demo.db` artifact and applies pending migrations to that copy. If demo seeding is enabled, it adds the construction examples without overwriting existing records. It never resets or migrates the source database or the database named in the inherited `DATABASE_URL`.

Next.js traces the migrated artifact into server functions. At runtime, it is copied once to `/tmp/crm-demo-contractor-v1.db`; an omitted artifact fails explicitly instead of silently opening an outdated seed or an empty database. `/api/health` checks construction tables and the new Task/Invoice columns, so a working SQLite connection with an outdated schema returns 503.

The migrated demo snapshot is also checked in so the deployment package contains it even if build environment detection changes. The explicit Vercel build always prepares this separate sample artifact, regardless of the inherited database URL. Ordinary local builds and non-file deployments using the default build skip preparation. Real databases still require an explicit migration deployment. The Vercel demo remains ephemeral; this fix does not provide durable customer data or file storage.

## 1. Database — Postgres

1. Create a managed Postgres (Neon, Supabase, Render, Railway).
2. In `prisma/schema.prisma`, change:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

3. Set `DATABASE_URL` to the Postgres connection string (prefer pooled URL for serverless).
4. Run:

```bash
npx prisma migrate deploy
npx prisma db seed   # optional
```

5. Remove Vercel-only SQLite copy logic reliance: keep `SEED_DEMO_DATA=false` and do **not** rely on `/tmp` files.

SQLite stays the default for local + the marketing demo so zero-config deploys keep working.

## 2. Email — real SMTP

Set in the host environment:

```env
EMAIL_TRANSPORT=smtp
SMTP_HOST=smtp.resend.com   # or your provider
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="CRM Solution <noreply@yourdomain.ge>"
APP_URL=https://your-domain.ge
SESSION_SECRET=<openssl rand -base64 32>
```

With `EMAIL_TRANSPORT=smtp` and `SMTP_HOST` set, invites / password resets / verify links leave the console and go through Nodemailer (`src/lib/email.ts`).

## 3. Lock down the demo surface

- `SEED_DEMO_DATA=false`
- Disable or protect `/api/demo-login` in production
- Rotate `SESSION_SECRET` and billing webhook secrets

## 4. What already works without Stripe

- Multi-tenant workspaces, roles, EN/KA
- Leads (RBAC + duplicate check) + public web form (`/{locale}/f/{companySlug}`)
- Quotes → Invoice (`QUOTE` → `SENT`)
- Drag-and-drop pipeline, month calendar, product catalog, funnel dashboard
