# Vercel deployment from GitHub

The selected host is the existing `crm-solution` project in `tavdos-projects`.
It is linked to `tavdo/CRM-SOLUTION`, with `main` as the production branch and
`https://crm-solution-two.vercel.app` as the primary origin. Other branches run
GitHub verification; automatic Vercel deployments are enabled only for `main`.

## Automatic releases

Push reviewed application changes to GitHub or merge a reviewed PR into `main`.
The Vercel GitHub integration reads that revision, installs with `npm ci`, runs
`npm run build:vercel` and publishes the resulting Next.js deployment. No Vercel
token, deploy hook or runtime secret is stored in GitHub Actions.

`vercel.json` selects Next.js and the single `sin1` region, close to the existing
Supabase PostgreSQL/storage region. Node.js is pinned to 24 in the project,
package engines and GitHub workflow. The build selects PostgreSQL from the runtime
database URL, generates the matching Prisma client and checks release settings.
Database migrations remain a separate operator action; a Git push never resets,
seeds or migrates the remote customer database automatically.

The GitHub `Verify launch candidate` workflow runs lint, type checking, the
ordinary suite, isolated PostgreSQL tests/backup restore, dependency auditing and
a local build. It uses disposable test credentials, not the real database.
These checks run alongside Vercel; the workflow alone is not a production
promotion gate. Inspect both results before considering a revision released.

## Runtime configuration

The ignored `.env.vercel.local` holds the approved runtime allowlist. Its values
are stored in the Vercel project's **production** environment, with nonempty
values marked sensitive. Development and branch builds do not receive these
credentials. The public repository contains placeholders only.

- `DEPLOYMENT_MODE=preview`, `REGISTRATION_MODE=database` for open early access.
  Each registration creates an isolated workspace and a password-authenticated
  account immediately. Email ownership remains unverified in the database.
- Restricted `crm_app` transaction pooler URL; the host's `DIRECT_URL` also uses
  `crm_app`, rather than the migration administrator.
- `APP_URL=https://crm-solution-two.vercel.app`, a separate session secret and
  `TRUSTED_IP_HEADER=x-real-ip` overwritten by Vercel.
- Existing private S3 storage via explicit `S3_*` credentials, plus Resend SMTP.
- Social messaging and billing disabled. Account emails, password-reset requests
  and email invitations are disabled during database registration. The retained
  Resend test sender is not used by this mode.

Database administrator/backup credentials and the backup encryption key remain
local. Existing Supabase users and records are retained, so the owner signs in
with the CRM password already chosen. A new hostname requires a fresh sign-in.
Local development remains SQLite-based; run `npm run db:generate` after a local
PostgreSQL cloud build when returning to ordinary local development.

## Verify and recover

Check the Vercel deployment is READY and its Git SHA equals the intended `main`
revision. Then run:

```powershell
npm run release:smoke -- https://crm-solution-two.vercel.app
```

This verifies database/schema health, public pages, CSS/JavaScript/images and
anonymous dashboard denial. Check real browser login and storage/email after
configuration changes. UptimeRobot should monitor the selected host's
`/api/health` every five minutes. Daily encrypted PC backups remain independent
of the web host; see `PRODUCTION.md` for their requirements and recovery steps.

For an application-only regression, revert the offending Git commit and push
the revert to `main`, or select a known-good Vercel deployment. A rollback does
not undo database migrations; schema changes need their own recovery plan.

The preview accepts registrations for early testing and keeps search indexing
disabled. Passwords are hashed and existing owner data stays in its own workspace.
Users must retain their passwords while email recovery is unavailable.

To return to owner-only access, unset `REGISTRATION_MODE` or set it to `verified`,
retain exactly one `PREVIEW_EMAILS` owner, and rebuild. Other accounts are retained
but cannot sign in to the restricted preview. To require email verification for
all accounts, configure a verified sender and support address, set
`REGISTRATION_MODE=verified` and `DEPLOYMENT_MODE=live`, then rebuild. Accounts
created during early access must verify their addresses before CRM access resumes.

The current Vercel team uses Hobby, limited to personal/noncommercial evaluation.
Before commercial launch choose an eligible Vercel plan, configure the purchased
domain, sender and support address, and repeat final release checks.
No paid upgrade is activated by this setup.
