# Georgian-first implementation increment — 2026-10-28

This is a local P0 hardening increment and selected P1 slices. It does not complete the roadmap or certify production readiness.

## Starting evidence

- Existing local edits already added an automation capability, provider helpers, owner-scoped lead services, and an invoice service. These were extended in place. Presentation documents, the original brief, generated output, and other unrelated local edits were preserved.
- `src/app/[locale]/(app)/contact-center/page.tsx` queried all workspace web leads; invoice list/detail pages also bypassed the existing invoice service. Customer/deal/task services filtered parents but included unrestricted related records.
- `src/app/actions/crm.ts` checked automation management on create, but unsupported rules could be re-enabled and the task-board action checked only tenant membership.
- `src/app/api/demo-login/route.ts` and `src/app/actions/auth.ts` accepted arbitrary account emails without passwords. The session helper had a known fallback secret in production.
- Invoice pages displayed invented fallback tax IDs/IBANs and successful-looking RS.ge badges. Invoice creation marked records SENT without delivery.
- Baseline lint and typecheck passed. Baseline Vitest: 6 files, 12 tests passed. The old isolation suite silently returns if demo fixtures are absent; its green status alone does not establish service isolation.
- `package.json` invoked `scripts/prepare-demo-db.mjs` on every build; that script removes/recreates `prisma/demo-seed.db`. The build now generates Prisma and compiles Next.js without invoking database recreation.

## Implemented P0 behavior

- Shared scope helpers enforce tenant/owner checks for primary reads, related contacts/deals/tasks/notes, dashboard relations, invoice lists/detail, contact-center lists, duplicate lookups, and arbitrary IDs accepted by writes. Restricted optional relations are returned as null. Invoices follow the linked customer's ownership because the schema has no invoice owner.
- Administrators manage automation through `company.automations`; the page and actions enforce it. Unsupported SMS cannot be created or enabled. Legacy active SMS rules produce `automation.skipped_unsupported` with `delivered: false`. Automated feed posts no longer copy private deal titles into the shared feed.
- Task-board changes enforce record ownership and validate stages. HR logs/leave queries restrict employee reads to their own entries. Audit queries require audit access. Membership screens select public member fields rather than whole user rows. The management chat channel checks management access on both reads and writes.
- Demo login permits only four fixed development demo identities and is disabled in production. Production requires SESSION_SECRET. Public health responses no longer expose account counts or raw database errors. Public form redirects are limited to the same origin.
- New invoices and converted quotes are DRAFT. PAID and SENT are shown as manual markings, not provider confirmations. Missing identity/bank data stays missing. RS.ge references have neutral styling and an explicit internal-reference notice. Provider states and explanations use Georgian/English catalogs; saved fields never imply provider connectivity.
- Production runtime no longer automatically creates schemas or seeds demo records. This does not resolve the remaining storage/deployment gates below.

## Implemented P1 slices

- Georgian phone formats (national, trunk prefix, +995, bare 995, and 00995) normalize consistently. Explicit international numbers retain their country code. Validation is syntactic; it does not verify allocation or reachability. The nine-digit Georgian format and 0/00 prefixes are based on the [ITU Georgian numbering plan](https://www.itu.int/dms_pub/itu-t/oth/02/02/T02020000500001PDFE.pdf). No carrier-prefix assumptions were added.
- New customer/contact/lead text uses NFC without transliteration. Original Georgian names remain Georgian. Duplicate comparison also handles supported legacy phone formatting, in bounded pages within the allowed scope. No existing records are bulk rewritten. Public duplicate inquiries do not overwrite existing notes.
- Deal close dates are validated date-only values. Task datetime-local inputs are interpreted in the company timezone, and task calendar dates use that timezone. Tests cover the UTC/Tbilisi day boundary and a nonexistent DST time. A repeated DST hour remains ambiguous without a separate offset input; new timestamp callers must follow the documented local-input contract.
- Invoice quantity/range checks reject fractional, nonfinite, negative, or overflowing amounts instead of silently clamping invalid input. Existing VAT arithmetic/defaults were not redesigned.
- An explicit ADMIN-only `company.export` capability protects the download route and service. Settings exposes JSON v1 and customers CSV with Georgian/English explanations. The user approved the sensitive payload and browser-download destination before implementation. See `WORKSPACE_EXPORT_SPEC.md` for the exact included/excluded data and consistency limits. Pages are bounded to 200 records, IDs and relationships are preserved, CSV neutralizes formula content, and audits contain format/version rather than personal data.
- Settings shows current record/member usage and plan limits, explicitly identifies example prices, and states that setup/support/provider/usage fees are not agreed. No commercial price or real charge was introduced.
- Mobile headers wrap instead of clipping actions. Touched Settings, automation, invoice, and contact-center grids adapt to narrow widths.

## Validation

- Vitest: 10 files, 54 tests pass, including 12 deterministic workflow/security tests in an isolated SQLite database. This fixture executes the repository migration SQL against a fresh file and removes only that fixture afterward; it does not test Prisma deployment history or PostgreSQL migration.
- The service workflow covers Georgian registration → lead → conversion to customer/deal → follow-up task → quote → draft invoice, with email/session boundaries mocked. Tests verify money totals, phone matching, date boundaries, forged action requests, nested-read isolation, export authorization/tenant filters, pagination, relationships, secret exclusion, Georgian encoding, CSV formula defense, and failed/cancelled export audit events.
- Browser checks used employee and administrator demo identities: Georgian sign-in/dashboard, employee invoice/contact-center screens, Georgian administrator Settings/export notices, and English Settings. Screens were inspected at 390×844 and 1280×900; a mobile header clipping issue was fixed and visually checked. Viewport overrides were reset. No real records were created through the browser or downloaded.
- The full sign-up and daily workflow was not completed through the browser. Real SMTP/inbox delivery, all mobile pages, every validation message, all locales/status catalogs, and provider sandboxes were not verified.
- Final lint, typecheck, production build, and `git diff --check` passed. The production server smoke check returned 404 for demo login, 401 for an unauthenticated export, 307 to sign-in for a protected dashboard, and 200 for sign-in. Local verification servers were stopped afterward.
- The initial sandbox build/dev startup failed loading the Windows SWC native binding; the same commands load correctly outside the sandbox. An overlapping build/dev run failed on the generated /_not-found entry; the final production build passed with the development server stopped. Next.js emitted existing dynamic-cookie prerender diagnostics and Prisma emitted its package-configuration deprecation warning; neither failed the build.

## Remaining dependencies and next slices

1. Complete daily-workflow localization, including authentication emails, service validation messages, generated defaults, remaining module labels/statuses, and accessibility/mobile checks across every core form. Add the optional onboarding checklist and focused sales navigation.
2. Validate legal-form and VAT onboarding rules with customers/qualified reviewers before changing defaults or tax calculations. Existing schema defaults still assume LLC/VAT registration. Phone normalization is not a substitute for verified telephone validation; Georgian/Latin aliases require customer-approved mapping.
3. Import preview/mapping/duplicates/reporting is not implemented. Export is a paginated live read, not an atomic backup snapshot, and can exceed deployment time limits for sufficiently large workspaces. Removed-user or pre-existing malformed references may remain unresolved; import must report them.
4. P2 automation still needs transactional transitions/effects, event/rule idempotency, outcome storage, and a durable outbox. Retrying a stage transition can still duplicate internal tasks. Invoice numbering remains count-based and needs concurrency-safe allocation. Lead conversion also needs transactional/limit hardening.
5. Provider demand research and a verified sandbox pilot have not begun. SMS/banking/RS.ge are unavailable or unconfigured; no delivery, collection, accounting, or tax submission was added.
6. Production requires a separately tested PostgreSQL transfer/migration/rollback path, durable hosting storage, removal of the Vercel ephemeral SQLite fallback in `src/lib/db.ts`, correct APP_URL and SMTP, rate limiting, session revocation/authentication review, MFA assessment, audit operations, actual hosting/subprocessor/retention documentation, and a successful restore drill. Demo login/runtime seeding guards do not make the current demo deployment production-safe.

## Measurement baseline

No customer telemetry or timing baseline was available for time to first useful action, onboarding completion, missed follow-ups, duplicate rate, delivery failures, export completion, support resolution, or representative annual costs. No numerical improvement is claimed. Establish these with consented pilot measurements and documented denominators before promising a benefit; synthetic test timing is not a customer baseline.
