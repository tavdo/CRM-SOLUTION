# Launch readiness — 2026-11-06

Free Supabase, Resend, Netlify and UptimeRobot accounts are configured. The hosted
owner-only preview is at `https://crmsolution2026-preview.netlify.app`; this is not
an open customer release. Final customer launch still depends on the purchased
domain and verified sender/support email. No paid plan or payment-card setup was
activated.

## Completed

- [x] DB-authoritative session revocation, unique tokens, fail-closed session
  persistence, atomic password reset and revocation of all devices.
- [x] Shared database rate limits for authentication and public lead forms;
  bounded public request parsing; trusted proxy configuration and safe fallback.
- [x] Dependency updates; full `npm audit` reports zero known vulnerabilities.
- [x] Production guards, separate ignored live settings, fresh session/backup
  secrets, default account/seed protection, disabled development billing.
- [x] PostgreSQL schema and separate migration baseline; isolated PostgreSQL CRM,
  isolation and concurrency checks; local SQLite data preserved.
- [x] Live Supabase migration applied in private `crm` schema. A separate `crm_app`
  runtime role has CRUD access without schema creation/superuser/role privileges;
  its connection was verified. Migration credentials remain separate.
- [x] Private Supabase `crm-private` bucket with 20 MB cap, configured server-side
  S3 credentials. Live upload/download and anonymous-access denial verified.
- [x] Project and inbox files use private S3-compatible storage, scoped project
  document keys and bounded downloads. Existing local files were not migrated.
- [x] Resend Free account and a sending-only SMTP key configured. TLS connection
  and authentication verified; sender-domain delivery is still pending below.
- [x] Georgian verification/reset/invitation email; real-production console
  fallback blocked; live email-verification gate and resend page.
- [x] Encrypted DB/media backups and safe extraction into an empty directory.
  Local SQLite backup integrity checked; isolated PostgreSQL full database restore
  passed. Initial live Supabase encrypted backup created and authenticated/extracted.
- [x] Public Georgian/English privacy, terms and contact pages, metadata, document
  language, sitemap/robots and private-route indexing controls. Existing public
  lead-form embeds remain supported.
- [x] CI verification, release smoke command and expired session/rate maintenance.
- [x] Operator display name configured as requested: CRMsolution2026. Account
  email is not automatically published as a support address.
- [x] Netlify Free project created and deployment uploaded, HTTPS preview origin
  opened publicly with the user's explicit approval. CRM access remains limited
  to the single configured owner email; registration, sessions and outgoing mail
  enforce that restriction, with email verification required and indexing disabled.
- [x] Netlify runtime settings read back and compared: no database administrator,
  backup connection or backup encryption key uploaded. Generated environment files
  stripped from the handler; function/browser artifacts checked before upload.
- [x] UptimeRobot Free HTTP monitor created for the preview `/api/health`, every
  five minutes, with email alerts enabled for the owner. External status `Up`
  observed after the corrected hosted deployment became healthy.
- [x] Read-only `crm_backup` database role provisioned and verified. Windows daily
  backup task registered for 04:00 Tbilisi; keeps seven encrypted archives in the
  operator's Documents folder outside the repository. First run and authenticated
  extraction passed. This requires the PC, signed-in user and internet.
  A separate `crm-preview-ready-2026-11-06.crmbak` snapshot of the verified owner
  account was also created with the read-only role and authenticated/extracted.
- [x] Owner's hosted CRM account created with ADMIN membership. Verification email
  accepted by Gmail, found and confirmed by the user. Database verification flag
  and successful browser access to the real hosted dashboard were verified.
  Before verification the same session was redirected to the verification page.

## Verified checks

- ESLint and TypeScript passed.
- Full unit/integration suite: 25 files, 151 tests passed. Separate PostgreSQL
  suite: 3 tests passed, plus runtime-role and encrypted restore verification.
- Production build passed.
- Isolated PostgreSQL: registration, lead conversion, project creation, tenant
  isolation, concurrent limits, restricted runtime role and encrypted DB restore.
- Real Supabase migration/runtime connection, private object storage and Resend
  SMTP TLS/authentication.
- Local HTTP smoke: health, KA/EN landing, sign-in, privacy, terms, contact,
  robots/sitemap and anonymous dashboard denial passed.
- Hosted database/HTML smoke passed, as did trusted proxy header spoof resistance.
  The static publish directory was corrected after visual QA found missing CSS
  and images. All 18 browser CSS/JavaScript/image assets passed status/content-type
  checks; desktop styling and the 390 px phone layout were verified online with
  no horizontal overflow. A real hosted form action rejected a non-owner
  registration without creating an account.
- Browser QA: desktop and 390 px phone layout, Georgian errors, persisted login,
  logout and Georgian sign-out redirect passed; phone layouts had no horizontal overflow.

## Remaining before public launch

- [ ] Buy the domain; Netlify Free hosting is already configured for the preview.
- [ ] Configure the final `APP_URL`, DNS, HTTPS and canonical-host redirects.
- [ ] Add/verify the sender domain in Resend and set the actual `SMTP_FROM`.
- [ ] Create a support address on the purchased domain, as requested, and set
  `SUPPORT_EMAIL`; review the public operator/contact and policy text.
- [x] Preview uses Netlify's `x-nf-client-connection-ip`. Two requests with
  different spoofed header values used the same real client bucket; neither a
  spoofed identity nor the shared fallback was accepted. Preserve this setting
  when promoting to the final Netlify hostname.
- [ ] Run final browser/email/file smoke tests on the deployed hostname, including
  verification, invitation, reset and replay rejection; run the live config check.
- [ ] Check the daily PC backup remains recent; retain the encryption key
  separately and arrange a second independent copy if required. Review host errors
  and capacity in addition to the external health monitor.

`npm run production:check:live` intentionally blocks a release while the final
origin, sender, support address or host-specific trusted IP header is missing.

## Deliberately deferred

`INBOX_ENABLED=false` in the live environment. Real social messaging still needs
provider accounts/approvals, Redis and a supervised worker. Online billing, SMS,
bank and RS.ge integrations are not activated. Do not advertise them as live.

The first unused Resend key was left in place at the user's explicit request;
the server uses the separately stored working sending-only key. Secret values
were saved to ignored local settings and the explicitly approved Netlify runtime
configuration, never repository source. Preview mail delivery to the owner has
been tested; sending to other recipients still needs a verified custom domain.

Local user data was backed up and the non-destructive rate-limit migration was
applied. It was not imported into the fresh remote CRM database. Existing user
edits in presentation documents and `scope.ts` were preserved.

See `PRODUCTION.md` for commands, credentials handling, migration, recovery and
free-plan limits. Free tiers are subject to provider limits and availability;
these are not promises of unlimited or uninterrupted hosting.
