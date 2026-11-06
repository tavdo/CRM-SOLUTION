# Production setup and free pilot

The local app remains SQLite-based. Live hosting uses PostgreSQL and a private
S3-compatible bucket. `npm run build` selects the Prisma schema from DATABASE_URL;
it never runs migrations against a customer database. Live releases must pass
`production:check` before building. There is no configured paid billing provider.

## Current free services

Supabase Free can supply PostgreSQL and private file storage. Resend Free supplies
transactional email after sender-domain verification. Use free plans without a
payment card or paid add-ons. Limits can interrupt service: they are not promises
of unlimited capacity or uninterrupted availability.

Netlify Free hosts the owner-only preview at
`https://crmsolution2026-preview.netlify.app`. The team uses the credit-free plan,
with no payment card or automatic overages configured. The site has been deployed;
check `LAUNCH_READINESS.md` for its current external access and smoke-test status.
`netlify.toml` supplies the build settings.
Vercel Hobby is restricted to personal non-commercial use. Do not treat it as the
commercial launch plan.

- https://supabase.com/pricing
- https://resend.com/pricing
- https://www.netlify.com/pricing/
- https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- https://vercel.com/docs/plans/hobby

## 1. Separate local and live environments

Keep `.env` for local development. Copy `.env.production.example` to the ignored
`.env.live.local` for a live candidate. This name is deliberate: Next.js must not
silently load unfinished live credentials into the local production preview.
Never commit this file or any key. On a host, set variables in its secret settings.
Use Node.js 22+ (24 is used by CI) and PostgreSQL client tools for backups.

Required live settings:

- `DEPLOYMENT_MODE=live`, `SEED_DEMO_DATA=false`.
- `DATABASE_URL`: a PostgreSQL runtime pooler URL, `schema=crm`, small connection
  pool; Supabase transaction pooler on 6543 uses `pgbouncer=true`.
- `DIRECT_URL`: direct PostgreSQL or Supabase session pooler on 5432, `schema=crm`.
  The session pooler supports IPv4 without the paid dedicated IPv4 add-on.
- Fresh random `SESSION_SECRET` (32+ characters).
- Final HTTPS `APP_URL` (origin only), actual `OPERATOR_NAME` and a monitored
  `SUPPORT_EMAIL` that the operator agrees to publish.
- SMTP, private storage settings below, `BILLING_PROVIDER=disabled`.
- `TRUSTED_IP_HEADER`: a header containing one IP address that the selected
  hosting edge or reverse proxy OVERWRITES. Never trust a header merely because a
  browser sent it. An absent or malformed header uses a shared fallback limiter;
  it does not disable throttling. Validate the host's real behavior before launch.

The setup assistant can prepare both connection URLs. Enter the **database**
password in `DATABASE_PASSWORD` in the ignored file, then run:

```powershell
npm run db:configure:live
```

This percent-encodes the password in both URLs and removes the extra password
field. It never prints passwords. This is not your Supabase dashboard password.
Do not put a password on a command line or send it in chat.

## 2. PostgreSQL migration and access

`prisma/schema.prisma` and `prisma/migrations` remain SQLite-specific.
`prisma/postgresql/schema.prisma` is synchronized from the same data model;
`prisma/postgresql/migrations` is a separate PostgreSQL migration history.
Do not run SQLite migration SQL against PostgreSQL or reset a customer database.

```powershell
npm run db:postgres:check
npm run db:deploy:live
npm run db:generate:live
npm run db:runtime:live
```

The baseline creates the private `crm` schema. Keep that schema out of Supabase's
exposed Data API schemas; no browser receives a database password or storage key.
The runtime provisioning command creates a dedicated `crm_app` role with only
schema usage and table/sequence CRUD privileges in `crm`, generates a separate
random password and writes the runtime URL into the ignored live environment.
It verifies the runtime connection and does not overwrite an existing role's
credentials. Keep schema-changing privileges in the `DIRECT_URL` migration
connection. Stop local Node servers before switching generated Prisma clients on
Windows; the loaded Prisma DLL cannot be replaced while in use.
Starter identities are blocked in live authentication; live seeding
is forbidden even when called explicitly.

The default live setup starts with an empty CRM database. The local database has
not been imported automatically. If actual local records must be retained, plan
and verify a separate data migration; JSON/CSV workspace export is not a full
restorable database backup.

After schema changes run `npm run db:postgres:sync` and generate/review a new
PostgreSQL migration; updating a generated schema does not update migration SQL.
The initial baseline is for a fresh database, not for overwriting existing tables.

## 3. Private files

For both project documents and inbox attachments:

```env
FILE_STORAGE=s3
INBOX_STORAGE=s3
S3_BUCKET=crm-private
S3_REGION=<region from provider>
S3_ENDPOINT=https://<project-ref>.storage.supabase.co/storage/v1/s3
S3_ACCESS_KEY_ID=<server-only S3 access key>
S3_SECRET_ACCESS_KEY=<server-only S3 secret>
```

Create `crm-private` with **Public bucket disabled**. A 20 MB bucket object limit
matches the inbox cap; project documents additionally enforce 8 MB in application
code. Supabase S3 access keys bypass RLS and cover all project buckets: use a
project dedicated to this app and keep the credentials server-side. Access checks
in CRM run before a private file is read. Outbound inbox files use short-lived
signed links because messaging providers need to fetch them.

The explicit `S3_*` credentials avoid Netlify's reserved `AWS_*` names and take
precedence over the hosting platform's AWS identity. Existing local `AWS_*`
configuration is still supported for compatibility. Free Netlify environment
imports must omit granular scopes; the current CLI's `env:import` can fail without
a useful exit status when it requests unsupported scopes. Always read back and
compare the stored runtime settings before deploying.

Changing storage settings does not move existing files. Migrate local storage
objects and preserve recorded storage keys before switching an existing deployment.
New project keys include workspace IDs; the reader retains legacy local-key support.

## 4. Email and verification

Use `EMAIL_TRANSPORT=smtp`, SMTP host/user/password, sender and TLS port. Port 465
uses implicit TLS; other supported ports use STARTTLS. Remote attachment URL/file
access in the mailer is disabled. Missing SMTP settings fail instead of silently
logging production email. Console delivery is limited to development or explicit
demo deployments.

For Resend set host `smtp.resend.com`, user `resend`, port 587 and a sending-only
API key as `SMTP_PASS`. After buying the domain, add it to Resend, publish its
required DNS records and wait for verification. Set the real `SMTP_FROM` address.
Do not treat SMTP authentication as successful message delivery.

```powershell
npm run services:check
```

This uploads/reads/removes one temporary storage object, verifies anonymous access
is denied on Supabase and verifies SMTP TLS/authentication. It does not send email.
Then send actual sign-up verification, invitation and password-reset messages to
controlled mailboxes using the final hostname. Confirm links and spam placement.
New live accounts must verify email before opening CRM. The verification page
supports rate-limited resend requests.

## 5. Backups and recovery

Generate a separate 32-byte base64 `BACKUP_ENCRYPTION_KEY`. Save it securely outside
the archive. A backup cannot be recovered without this key. Backups include the
DB, media and inbox encryption key, not `.env` files or service credentials.
Use a maintenance window for a DB/media snapshot: they are not a cross-service
atomic transaction. Supabase Free does not substitute for a tested backup process.

```powershell
npm run backup:live -- --output backups/first-live.crmbak
# Local SQLite uses npm run backup instead.
```

For PostgreSQL install a matching-or-newer `pg_dump` and place it on PATH or set
`PG_DUMP_PATH` to its absolute executable path. Database credentials are passed in
process environment, not command arguments. SQLite snapshots use the native backup
API, including live WAL state. Archives use authenticated AES-256-GCM encryption;
partial archives are not treated as complete backups.

```powershell
# Use the same BACKUP_ENCRYPTION_KEY as archive creation.
node --env-file=.env.live.local scripts/backup.mjs restore --input backups/first-live.crmbak --to-dir backups/recovery-check
```

Restore authenticates before extraction and requires an empty destination. It
never overwrites/imports into a live DB. For an isolated PostgreSQL restore, create
a new empty verification database, use `pg_restore --no-owner --no-privileges
--exit-on-error` on `database.dump`, then verify record counts, relationships and
application access. Supply connection secrets via PostgreSQL environment variables,
not shell arguments. SQLite recovery opens `database.sqlite` read-only first and
runs `PRAGMA integrity_check`. Restore media into private storage with the recorded
keys and retain `inbox-key.json` securely. Do not import a backup into an existing
customer database without a reviewed recovery procedure.

A separate `crm_backup` role has SELECT/USAGE privileges and defaults to read-only
transactions. Its `BACKUP_DATABASE_URL` and encryption key stay in the ignored
local live settings; neither is sent to Netlify. Provision/verify it with
`npm run db:backup-role:live` while the PostgreSQL Prisma client is generated.

Windows task `CRMsolution2026-DailyBackup` is registered for 04:00 Tbilisi time,
with missed runs starting when available. It runs as the signed-in Windows user,
requires this PC and internet, and does not wake or run on a powered-off PC.
`npm run backup:scheduled` can run it manually. Archives are written outside the
repository to `C:\Users\temot\Documents\CRMsolution2026-Backups`; the newest seven
dated archives are retained. The first archive and a successful task run have
been verified, including authenticated extraction. `backup-status.json` and
`backup.log` in that directory record success/failure without credentials.
Keep the encryption key separately recoverable. This operator-owned copy is
outside Supabase, but is not an always-on cloud backup or a second independent
offsite copy of the PC. Review backup age and periodically test full recovery.

## Owner-only Netlify preview

The ignored `.env.preview.local` contains an explicit runtime allowlist copied to
Netlify: restricted `crm_app` connections, private storage, SMTP and a separate
preview session secret. Database administrator, read-only backup credentials and
backup encryption keys are excluded. `DIRECT_URL` on the web host uses the runtime
role, not the migration administrator. Apply migrations separately from this PC.

`DEPLOYMENT_MODE=preview` requires exactly one `PREVIEW_EMAILS` owner address.
Registration, sessions, invitations and outgoing mail enforce that restriction;
verification remains required. The preview permits Resend's test sender and an
empty support address. It disables search indexing and advertises restricted
registration. This is preparation for launch, not open customer registration.

```powershell
# Install the official CLI once, then authorize against the correct free team.
npm exec --yes --package=netlify-cli -- netlify --version
npm run netlify:configure:preview
npm run netlify:build:preview
npm run deploy:preview
npm run release:smoke -- https://crmsolution2026-preview.netlify.app
```

The Next adapter explicitly copies local environment files into its generated
handler independently of tracing exclusions. The deploy command removes those
generated copies, checks function archives for local/admin/backup secrets,
checks browser assets for runtime credentials, and verifies the Linux Prisma
engine before uploading. Original local settings remain intact. Always rebuild
and use this checked deployment command; do not upload a raw build directory.
The deploy command explicitly publishes the adapter's `.netlify/static` directory;
publishing the original `.next` folder after a separate build omits browser assets.
The HTTP smoke test checks CSS, JavaScript and image status/content types as well
as HTML pages and database health. The artifact checker uses Python 3.
Run `npm run db:generate` after finishing a
cloud build to return the local Prisma client to SQLite.

After buying the domain, configure and verify DNS, HTTPS, mail sender and support
address, update the host variables and `APP_URL`, then switch to `live` and pass
the live config/build checks. `PREVIEW_EMAILS` should only be removed as part of
that reviewed customer release.

## 6. Social messaging is optional for this pilot

Keep `INBOX_ENABLED=false` until accounts, provider approvals, Redis and a supervised
worker are available. Both UI/API access and webhook processing report disabled
messaging instead of implying delivery. To enable it, configure private media,
`INBOX_ENCRYPTION_KEY`, durable Redis and worker monitoring, then follow
`OMNICHANNEL_INBOX.md`. A serverless web deployment does not by itself run the
existing continuous BullMQ worker. Do not assume a Redis free tier will cover an
always-polling worker's command volume.

## 7. Checks, monitoring and release

```powershell
npm run lint
npm run typecheck
npm test
npm run test:postgres
npm audit --audit-level=moderate
npm run production:check:live
npm run build:live
npm run release:smoke -- https://your-domain.ge
```

`test:postgres` starts a loopback-only isolated local PostgreSQL instance using
installed binaries, applies the baseline, exercises CRM/isolation/concurrent
limits and encrypts/restores a real PostgreSQL backup. It restores the local Prisma
client afterward. On CI, TEST_POSTGRES_URL targets the disposable PostgreSQL
service. User databases are never reset by the verification command.

`/api/health` checks DB schema availability, including rate-limit storage. Monitor
it externally after deployment, plus errors, capacity, mail failures and backup age.
For messaging additionally monitor the worker, Redis, provider failures and outbox
age. Health alone does not prove these dependencies work. Run `npm run maintenance`
against the intended database periodically to remove expired session/rate buckets.
Do not automate deletion of customer history under that command.

After the domain purchase: configure host DNS/HTTPS, `APP_URL`, canonical hostname
redirects, mail DNS/sender and any provider callbacks. Review operator/contact
information and legal text before publishing. Browser-test phone and desktop,
registration, verification, invitations, reset/replay rejection, files, invoices
and role/workspace isolation. Release one reviewed revision with a recovery path.

Public privacy/terms/contact pages, metadata, robots and sitemap are implemented.
Private CRM routes and token-bearing pages are excluded from indexing; that does
not replace authentication. Public lead-form embeds remain supported.
