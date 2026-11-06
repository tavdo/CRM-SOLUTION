# CRM Solution — Handover

Updated 2026-11-06. See `LAUNCH_READINESS.md` for verified status and
`PRODUCTION.md` for exact setup/release/recovery steps.

## Application

The application supports Georgian/English workspaces, roles, leads, customers,
contacts, deals, tasks, products, invoices, construction projects and an optional
omnichannel inbox. The bundled local evaluation workspace has one administrator,
one manager and one user; it contains no seeded customer/project records. Never
use those published evaluation credentials for a real customer deployment.

## Launch hardening completed

- DB-backed session revocation; unique signed login tokens; failed session writes
  never issue a cookie; reset consumes tokens atomically and revokes all devices.
- Shared atomic database rate limits for authentication and public inbound forms,
  bounded request parsing and explicit trusted-proxy configuration.
- Fresh local secrets, production configuration checks, no tracked deployment
  secrets, live demo-account/seed protection and disabled development billing.
- Separate PostgreSQL schema and migration baseline, validated on isolated local
  PostgreSQL without resetting user databases. SQLite remains the local default.
- Private S3-compatible project/inbox file storage, scoped document keys and
  bounded downloads. Existing local files require a deliberate storage migration.
- SMTP with TLS and no production console fallback; Georgian security email;
  live email-verification gate and resend UI.
- Authenticated encrypted database/media backup and extraction tools; real
  PostgreSQL backup restore verified against an isolated database.
- Public Georgian/English privacy, terms and contact pages; public-page metadata,
  robots/sitemap, correct document language and private-route indexing controls.
- CI verification workflow, release HTTP smoke command and expired-session/rate
  maintenance command. Their hosting schedules are not automatically configured.
- Dependency updates and narrowly documented compatibility overrides; current
  full npm audit is clean.

## Verification

The launch security suite exercises retained-token replay after logout/reset,
failed session persistence, concurrent limits, missing production configuration,
SMTP TLS configuration and private-storage behavior. PostgreSQL verification
covers registration, lead conversion, project creation, tenant isolation,
concurrent limits and encrypted database backup/restore. The ordinary suite
continues to cover CRM, construction and inbox workflows.

## External work

Free Supabase, Resend, Netlify and UptimeRobot accounts were opened with the user's
participation. The private Supabase database/storage and SMTP authentication were
verified. Netlify hosts the owner-only preview at
`https://crmsolution2026-preview.netlify.app`. Runtime credentials are allowlisted;
database administrator and backup credentials stay on the operator's PC.

UptimeRobot checks `/api/health` every five minutes with owner email alerts.
Windows task `CRMsolution2026-DailyBackup` runs at 04:00 Tbilisi and keeps the latest
seven encrypted copies in `C:\Users\temot\Documents\CRMsolution2026-Backups`.
The task requires this PC, a signed-in user and internet; a missed run starts when
available. A separate read-only database role is used for backups. Save the
encryption key independently and inspect backup age/status. See the readiness
report for current hosted health and the remaining real email/browser checks.

The owner account is registered, email-verified and has ADMIN membership. The
hosted dashboard was opened successfully. Resend's test sender delivered the
verification email to Gmail; custom-domain mail to customers remains pending.

Before customer launch configure the final domain/DNS/HTTPS, verified mail sender
and support address, review operator/policy text, switch preview to live, and run
the final browser/email/file smoke tests.
Social messaging remains optional and needs provider accounts/approvals, durable
Redis and a supervised worker. Live billing, SMS, bank and RS.ge integrations are
not activated.

No public launch, payment activation or customer-data reset is implied by these
local changes. Existing user edits in presentation documents and `scope.ts` were
preserved.
