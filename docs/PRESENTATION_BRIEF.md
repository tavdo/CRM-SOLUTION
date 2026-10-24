# CRM Solution: project and presentation brief

Prepared on 24 October 2026 from the documentation, schema, services, UI, configuration, and tests in this repository. This is a presentation reference, not a production certification or a claim of measured business results.

## 1. Project identity

**Project name:** CRM Solution  
**Package version:** 0.1.0  
**Product category:** Customer relationship management web application with foundations for a subscription SaaS product  
**Current stage:** Working MVP and demonstration application with production work remaining  
**Languages:** English and Georgian  
**Defaults:** Asia/Tbilisi timezone and GEL currency

**One-sentence description:** CRM Solution gives a company a workspace for customer information, sales opportunities, and follow-up tasks, with English and Georgian interfaces and access based on team roles.

**Suggested presentation title:** CRM Solution: A Bilingual Workspace for Sales Teams

**30-second introduction:**

> CRM Solution is a bilingual web application for managing customer relationships and sales work. Teams can keep customer details and contacts together, track opportunities through a sales pipeline, and assign follow-up tasks with due dates. Administrators configure the workspace and manage members, while managers and employees work with the records available to their roles. The current MVP includes a dashboard and subscription foundations. Live payments and production hardening remain future work.

## 2. Problem, audience, and intended value

The product addresses a common workflow problem: customer details, sales progress, and follow-up responsibilities can become scattered across separate tools. A shared CRM provides context and makes ownership visible.

The repository does not contain customer interviews, market research, adoption figures, or measured return on investment. Present the problem as the product's rationale and the benefits as intended outcomes.

Likely target users, inferred from the product design:

- Small and growing sales teams that need a shared customer and deal workflow.
- Georgian-speaking teams and teams that work in both Georgian and English.
- Company administrators who manage access and workspace configuration.
- Sales managers who supervise the full workspace pipeline.
- Employees who work primarily with their assigned records.

| Workflow difficulty | Product response | Intended benefit |
| --- | --- | --- |
| Customer context lives in separate places | Customer profiles with contacts, notes, and related deals | Easier access to relationship history |
| Sales progress is difficult to review | Pipeline board and deal list | Clearer opportunity status |
| Follow-up responsibility is unclear | Assigned tasks, due dates, and overdue indicators | More visible accountability |
| Team members need different access | Admin, Manager, and Employee roles | Access that reflects responsibilities |
| Teams use Georgian and English | Locale switching and translated interface messages | More accessible daily use |
| Several companies use one application | Company-scoped records and membership checks | Separate workspace contexts |

Avoid claiming a percentage increase in sales, reduced costs, proven security, or superiority over named competitors without additional evidence.

## 3. Feature inventory

### Accounts and workspaces

- Company registration creates an administrator, a workspace, default pipeline stages, and a trial subscription.
- Sign-in and sign-out flows.
- Email verification and password reset flows. Development email appears in the server console by default.
- Memberships connect global user identities to companies.
- Workspace switching for users who belong to several companies.
- Membership checks resolve the active workspace on the server.
- Member invitations with a stored role, expiry, and acceptance status.
- Administrator protection against removing or demoting the last administrator.

### Customers and contacts

- Customer creation and profile editing.
- Name, email, phone, website, address, and record owner.
- Search by customer name, email, or phone.
- Paginated customer lists, with a default page size of 20 and a service maximum of 50.
- Customer soft archiving rather than deleting the row.
- Contacts with first name, last name, email, phone, and job title.
- Customer notes with author and creation time.
- Related deals on the customer profile.
- Customer custom fields with TEXT, NUMBER, DATE, and SELECT types.
- Administrator controls for adding and archiving custom field definitions.

Contacts appear within customer profiles. The current navigation does not provide a separate contacts application.

### Sales and deals

- Pipeline board and table views.
- Deal creation and editing with title, customer, owner, amount, currency, and expected close date.
- Stage changes through a selection control on each board card.
- Default stages: New, Qualified, Proposal, Negotiation, Won, and Lost.
- Open, Won, and Lost deal statuses.
- Dedicated close-deal action with a required reason for a Lost outcome.
- Deal activity history for creation, stage changes, and closing.
- Linked tasks on deal detail pages.
- Administrator stage creation and stage removal with a replacement destination for affected deals.

The board does not implement drag-and-drop. Stage renaming and ordering have service support, but the current settings UI focuses on adding and removing stages. The schema supports archived deals, but there is no corresponding deal archive action in the reviewed application. Avoid presenting either as a finished UI feature.

### Tasks and follow-ups

- Task creation with title, optional description, due date, and assignee.
- Optional customer and deal links.
- Open and Done statuses, including completion and reopening.
- List filters supported by the service for status, owner, overdue state, and title search.
- Overdue calculation for an Open task whose due time is earlier than the current instant.
- Managers and administrators can assign work to workspace members.
- Employees create tasks for themselves and have ownership restrictions on direct task access.

Task editing exists as a service function. The reviewed task detail page exposes completion and reopening rather than a full editing form. Scheduled email or push reminders are not implemented.

### Dashboard

The dashboard queries stored CRM data when the page renders. It has no implemented live-push collaboration mechanism.

| Metric or section | Definition |
| --- | --- |
| Active deals | Open deals with no archive timestamp |
| Pipeline value | Sum of active deal amounts, shown separately for each currency |
| Open tasks | Tasks with Open status |
| Won this month | Unarchived Won deals with a close timestamp in the current UTC calendar month |
| Overdue tasks | Open tasks due before now, showing up to 10 |
| Upcoming tasks | Open tasks due during the next seven days, showing up to 10 |
| Recent customers | Up to five unarchived customers ordered by latest update |

Employees receive an owner scope on these top-level dashboard queries. Do not call pipeline value revenue, a forecast, or profit. Do not describe the displayed overdue list length as an unlimited count of all overdue tasks.

### Settings and audit records

- Company name, timezone, default interface locale, and currency settings.
- Member list, invitations, role changes, and member removal.
- Pipeline and custom field controls.
- Subscription plan, status, trial end, and limits.
- Local simulated plan changes.
- Administrator view of the 20 most recent audit events.
- Audit records for selected important changes. This is not evidence of a complete compliance audit system.

## 4. Roles and access model

| Capability | Admin | Manager | Employee |
| --- | --- | --- | --- |
| Configure company settings | Yes | No | No |
| Manage members and roles | Yes | No | No |
| Configure pipeline and custom fields | Yes | No | No |
| Manage subscription settings | Yes | No | No |
| View administrator audit panel | Yes | No | No |
| Access all workspace CRM records | Yes | Yes | No |
| Assign CRM ownership and tasks to others | Yes | Yes | No |
| Create own customers, deals, and tasks | Yes | Yes | Yes |
| Access own assigned CRM records | Yes | Yes | Yes |

The permission helpers and core record services implement this model. Company IDs scope the main CRM queries, and membership checks determine workspace access. This should be described as the implemented access model, not as proof that every nested query or mutation is fully hardened. Additional authorization review remains a production task.

## 5. Subscription foundations and commercial status

The application stores plans and one subscription per company. New registrations use a configurable trial, currently 14 days in the seed and fallback Starter setup.

| Seed plan | Users | Active customers | Unarchived deals | Example monthly price |
| --- | --- | --- | --- | --- |
| Starter | 10 | 500 | 1,000 | GEL 49, placeholder |
| Growth | 25 | 2,000 | 5,000 | GEL 149, placeholder |

These values come from the seed code. They are configurable demo settings, not approved commercial offers. Registration can create a zero-priced fallback Starter plan if the seeded plan does not exist. The main presentation can omit prices entirely.

Subscription states: Trialing, Active, Past Due, Canceled, and Expired.

- Plan checks run on member invitation/acceptance, customer creation, and deal creation.
- The current gate considers Trialing, Active, and Past Due usable.
- Canceled or Expired status blocks these gated creation operations.
- Payment state changes do not trigger CRM data deletion.
- The current logic does not provide a complete automatic trial-expiry lifecycle.
- Development billing events can activate, renew, cancel, expire, or mark a subscription past due.
- The webhook uses HMAC-SHA256 signature verification and checks stored external event IDs to avoid sequential duplicate processing.
- Stripe is a reserved integration path. The code does not contain an active Stripe checkout or payment integration.

**Presentation wording:** "Subscription plans, limits, and simulated billing events are implemented. Live payment integration remains future work."

## 6. Technical architecture

The application uses a single full-stack Next.js project. It does not contain a separate Express backend or a microservices deployment.

| Layer | Implementation |
| --- | --- |
| Application framework | Next.js 15.5.28 with the App Router |
| UI | React 19.1.0 and reusable components |
| Language | TypeScript |
| Styling | Tailwind CSS 4 plus custom CSS |
| Icons | lucide-react |
| Data access | Prisma 6 |
| Current database | SQLite |
| Localization | next-intl 4 with English and Georgian message catalogs |
| Authentication | Signed JWT cookie, with session table recording and database-token fallback |
| Password hashing | bcryptjs |
| Validation | Zod in sign-up, plus manual checks in other paths |
| Email | Nodemailer with console or SMTP transport |
| Tests | Vitest |
| Static checks | ESLint and TypeScript |

Typical request flow:

1. A user opens a locale-prefixed page or submits a form.
2. A server page or server action resolves the signed-in user and active membership.
3. A domain service checks relevant capabilities and record scope.
4. Prisma queries or updates the SQLite database.
5. The application renders the result or revalidates the relevant page.

Important data relationships:

- User connects to Company through Membership, which stores the role.
- Company contains customers, contacts, pipeline stages, deals, tasks, notes, and audit events.
- Customer links to contacts, deals, tasks, notes, and custom field values.
- Deal links to a pipeline stage and can link to a customer and contact.
- Deal has task links and activity history.
- Custom field definitions describe values stored for individual customers.
- Company has a Subscription, which references a Plan and has BillingEvents.

Amounts use integer minor units, such as tetri for GEL. Currency totals remain separate. The code does not perform currency conversion. Dates use stored timestamps and company-timezone formatting. The monthly wins boundary uses UTC.

## 7. Localization and interface design

- English routes use `/en` and Georgian routes use `/ka`.
- The language switcher changes the interface locale.
- User language preference and company default locale are separate settings.
- Customer names and notes remain as entered. There is no automatic translation of CRM content.
- Some labels and status strings remain in English in the current implementation. Describe the app as bilingual, avoiding a claim of complete translation coverage.
- The interface uses a dark background, emerald and cyan accents, panels, tables, and pipeline columns.
- Responsive navigation includes a mobile menu.

Actual CSS colors suitable for a matching deck: background `#05080D`, emerald `#10B981`, cyan `#06B6D4`, foreground `#F8FAFC`, and muted text `#8B9BB4`.

## 8. Demonstration and deployment status

The seed defines two demonstration companies and an Admin, Manager, and Employee for each company. Alpha uses English defaults and Beta uses Georgian defaults. It also creates sample customers, opportunities, linked tasks, an Industry custom field, and notes.

Sample deal names such as "Security Audit & SSO Rollout" describe fictional opportunities in the CRM. They do not mean this application implements SSO, ERP integration, or security-audit tooling.

The repository includes Vercel configuration, a bundled demo database, and runtime copying of that database into temporary storage. This supports demonstration behavior. Temporary SQLite data is not durable shared production storage across serverless instances.

The code contains SQLite-specific initialization. Moving to PostgreSQL requires schema-provider changes, migrations, and runtime initialization changes. Changing only `DATABASE_URL` is insufficient.

There is no verified public deployment URL in this brief. A configuration file does not establish that a deployment is live.

## 9. Current verification and limits of evidence

Checks run during preparation on 24 October 2026:

- `npm.cmd test`: 6 test files and 12 tests passed.
- `npm.cmd run typecheck`: passed.
- Both demo company rows and five customer rows were present in the local database, satisfying the isolation test's data prerequisites.
- `npm.cmd run lint`: passed.

The test suite covers role helpers, company-scoped customer lookup, demo password hashes, money helpers, overdue dates, slug helpers, and billing signature generation. It does not establish comprehensive end-to-end security or production readiness.

The existing handover reports a prior successful production build and browser smoke checks. Those are historical repository statements. A fresh build and browser walkthrough were not run while preparing this brief. The build script recreates the tracked demo database, so a build is not a read-only presentation check.

## 10. Limitations and sensible next steps

The following are implementation observations or proposed next steps, not completed features or an approved delivery schedule.

**Before use with real customer data:**

- Restrict or remove the unauthenticated demo-login endpoint, which currently accepts an email and issues a session for the matching user.
- Replace demo configuration secrets and review authentication behavior.
- Align JWT validation with session revocation. The current JWT path can remain valid independently of a deleted session-table row, so password-reset session deletion does not by itself guarantee JWT revocation.
- Review ownership checks on related-record reads and mutations, including contacts, notes, and linked records.
- Replace temporary SQLite demonstration storage with a durable database and adapt the SQLite initialization path.
- Review invitation acceptance for existing accounts and complete abuse-prevention and validation checks.

**For a production subscription service:**

- Configure and test real SMTP delivery.
- Implement a payment provider and approve actual plans and prices.
- Complete trial-expiry and billing lifecycle behavior.
- Configure backups, monitoring, and deployment operations.
- Decide retention and workspace deletion policies.
- Extend tests around real user flows and access boundaries.
- Complete translation coverage and UI/service consistency.

Calendar, chat, documents, and advanced automation are explicitly outside the current release. AI lead scoring, forecasting, mobile apps, SSO, and third-party CRM integrations are not implemented features in the reviewed code.

## 11. Suggested 15-slide presentation

Assumption: English, mixed business and technical audience, approximately 10–12 minutes including a short demonstration. Keep the implementation caveats detailed in speaker notes and make production status visible on the readiness slide.

| Slide | Title | Main content | Suggested visual | Speaker emphasis |
| --- | --- | --- | --- | --- |
| 1 | CRM Solution | Bilingual CRM for customer relationships and sales work. Presenter name placeholder. | Actual dashboard screenshot, if available | Introduce the working MVP and its scope. |
| 2 | The workflow problem | Scattered customer details, unclear deal progress, and missed follow-up responsibility. | Simple comparison of a fragmented workflow and a shared CRM workflow | These are product motivations, with no research statistics claimed. |
| 3 | Who uses the workspace | Administrators configure it. Managers oversee sales. Employees handle assigned work. Georgian and English teams are the likely audience. | Role cards | Explain target users as an inference from the design. |
| 4 | One connected sales workflow | Register a workspace, capture a customer, create an opportunity, assign a follow-up, and record the outcome. | Numbered workflow | Keep the story centered on one representative sales process. |
| 5 | Customer context in one profile | Contact details, contacts, notes, related deals, and custom fields. Search and pagination support daily navigation. | Actual customer profile screenshot | Show how the record keeps relationship context together. |
| 6 | Sales opportunities have visible stages | Board and list views. New, Qualified, Proposal, Negotiation, Won, and Lost. Owners, amounts, and activity history. | Actual board screenshot | Stage changes use a selector. Describe the loss-reason requirement specifically for the dedicated close action. |
| 7 | Follow-up work has an owner and due date | Assigned tasks linked to a customer or deal. Open, Done, overdue, and upcoming work. | Actual task screen or clearly labeled conceptual example | Distinguish due-date tracking from automated reminders. |
| 8 | The dashboard shows current CRM activity | Active deals, pipeline value by currency, Open tasks, and wins this UTC month. | Actual dashboard screenshot | Pipeline value is opportunity value, not recognized revenue. |
| 9 | Roles define access within a company | Admin, Manager, and Employee permission matrix. Company membership determines the workspace. | Compact role table | Explain the model without making a security certification claim. |
| 10 | English and Georgian support daily use | Locale-prefixed routes, language preference, company timezone, and unchanged customer-entered text. | Real English and Georgian screens side by side | Acknowledge remaining English labels in notes. |
| 11 | One full-stack application | Next.js and React UI, server actions and services, Prisma, and SQLite. | Simple architecture diagram | PostgreSQL is a future migration, not the current database. |
| 12 | Relational data connects the workflow | Company, Membership, Customer, Contact, Deal, Stage, Task, and subscription relationships. | Simplified entity diagram | Mention integer minor units and separate currency totals. |
| 13 | Subscription foundations are implemented | Trial, plan limits, subscription states, and signed development webhooks. | Small plan-limit comparison and status flow | Live payments are not integrated. Prices are configurable placeholders. |
| 14 | A working MVP with production work remaining | 12 tests and TypeScript passed. Demo workspaces exist. Durable storage, authentication hardening, SMTP, and live billing remain. | Implemented and next-step status table | Keep verification scoped to the checks actually performed. |
| 15 | Demonstration and questions | Customer profile, deal stage change, linked task completion, dashboard refresh, and language switch. | Screenshot strip or live demonstration | Close with the intended benefit: a shared view of customer relationships and sales responsibilities. |

Suggested pacing: introduction and problem 1.5 minutes, product workflow 4 minutes, access and localization 1.5 minutes, architecture and subscriptions 2 minutes, readiness and demonstration 2 minutes. Adapt to the allotted speaking time.

## 12. Short demonstration script

Use local demo data. Do not expose environment files or real customer records during the presentation.

1. Sign in through the normal sign-in page at `/en/sign-in` using the documented local demo administrator account.
2. Show the dashboard and explain what pipeline value means.
3. Open Customers, search for a seeded customer, and open its profile.
4. Show contact information, a note, and the Industry custom field.
5. Open Sales, select an existing deal, and move it to a different open stage using its selector.
6. Open a linked task and mark it complete.
7. Return to the dashboard with a page refresh or navigation so the latest values render.
8. Switch the interface to Georgian and show that customer-entered text remains unchanged.
9. If time allows, show Settings for roles, stage configuration, and the subscription panel's simulated status.

Seeded due dates are relative to the time seeding ran. They can become stale. Preview the demonstration before presenting. Use screenshots as a fallback if local runtime behavior changes.

## 13. Likely questions and prepared answers

**What makes this project useful?**  
It connects customer context, opportunity progress, and assigned follow-up work in one bilingual workspace. The intended value is clearer sales coordination. Measured business impact has not been established.

**Can several companies use it?**  
The data model supports several companies, and the main CRM services scope queries by company. User membership determines the active workspace. Production authorization review remains necessary.

**What is the difference between a customer and a deal?**  
A customer stores the relationship information. A deal represents a specific sales opportunity with a stage, owner, amount, and outcome. One customer can have several deals.

**Does the board support dragging cards?**  
The implemented board moves deals through a stage-selection control.

**Does the application support different currencies?**  
Deals store a currency and an amount in minor units. Totals group by currency. The application does not convert exchange rates or combine different currencies into one total.

**Are all user sessions centrally revocable?**  
The current implementation validates a signed JWT and also maintains session-table support. Revocation needs further work because JWT validation does not require the session row to remain present.

**Can customers subscribe and pay today?**  
The app has plan limits, trial and subscription states, and a development webhook. Live checkout and payment collection are not implemented.

**Is it deployed publicly?**  
The repository contains Vercel demo configuration. No public deployment was verified in preparing this presentation.

**Why SQLite?**  
It keeps local setup simple and supports the demonstration. Durable production hosting requires a different storage setup, with PostgreSQL proposed in the project documentation.

**What has been tested?**  
The current run passed 12 tests across six files and the TypeScript check. Tests cover specific helpers and a tenant-scoped database lookup. They are not a complete browser or security test suite.

## 14. Source map and documentation differences

Repository-relative paths below identify the evidence used. Prefer the current implementation when older documentation differs.

| Topic | Sources |
| --- | --- |
| Product scope and prior handover | `README.md`, `docs/ARCHITECTURE.md`, `docs/HANDOVER.md` |
| Technology and scripts | `package.json`, `next.config.ts`, `vitest.config.ts`, `eslint.config.mjs` |
| Data model | `prisma/schema.prisma` |
| Roles and workspace checks | `src/lib/permissions.ts`, `src/lib/auth/workspace.ts` |
| Authentication | `src/lib/auth/session.ts`, `src/app/actions/auth.ts`, `src/lib/crypto.ts` |
| Accounts and invitations | `src/lib/services/onboarding.ts`, `src/lib/services/members.ts` |
| CRM behavior | `src/lib/services/customers.ts`, `src/lib/services/deals.ts`, `src/lib/services/tasks.ts`, `src/app/actions/crm.ts` |
| Metrics, money, and dates | `src/lib/services/dashboard.ts`, `src/lib/money.ts`, `src/lib/dates.ts` |
| Billing | `src/lib/billing/adapter.ts`, `src/app/api/billing/webhook/route.ts` |
| Actual screens | `src/app/[locale]/(app)/`, `src/components/AppShell.tsx`, `src/components/MoveDealSelect.tsx` |
| Language and styling | `src/i18n/`, `src/app/globals.css` |
| Demo and hosting behavior | `src/lib/demo-seed.ts`, `src/lib/db.ts`, `src/lib/db-init.ts`, `src/app/api/demo-login/route.ts`, `scripts/prepare-demo-db.mjs`, `vercel.json` |
| Automated verification | `tests/*.test.ts` |

Notable differences to preserve in the presentation:

- Architecture documentation describes database-only revocable cookie sessions. Current code validates signed JWTs first.
- The current database provider and initialization are SQLite-specific. PostgreSQL migration requires more than a connection-string change.
- The handover's "full" bilingual UI claim is broader than the translated UI labels currently observed.
- Documentation says a loss reason is required. The dedicated close action enforces it, while the general stage-move path does not.
- Some features described broadly in the handover exist in the schema or service layer without a complete current UI.

### Final verification note

The current preparation run passed tests, TypeScript checking, and lint. It did not rerun the production build or browser smoke tests.
