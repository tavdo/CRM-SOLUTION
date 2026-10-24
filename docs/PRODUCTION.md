# Production path (beyond the Vercel SQLite demo)

The public Vercel demo uses **ephemeral SQLite** under `/tmp` plus console email. That is fine for a portfolio. For a real Georgian SMB tenant, switch both.

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
