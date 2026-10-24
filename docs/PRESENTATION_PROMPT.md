# Ready-to-use presentation prompt

Copy everything below into your presentation generator. This prompt is self-contained. If the tool accepts reference files, also attach `PRESENTATION_BRIEF.md` from this directory for detailed speaker notes and source references.

---

Create a 15-slide presentation in English about my software project, **CRM Solution**.

## Audience and purpose

Assume a mixed audience of project evaluators, developers, and business stakeholders. The presentation should explain the problem, demonstrate the working product, summarize the architecture, and accurately distinguish the current MVP from future production work. Target 10–12 minutes, including a brief product demonstration. Use a clear, confident, factual tone.

Use the project facts below as the source of truth. Where information is missing, leave a labeled placeholder instead of inventing it. Presenter name, institution/company, team members, and project URL are not supplied.

## Project facts

CRM Solution, package version 0.1.0, is a working bilingual CRM MVP. It gives companies workspaces for customer information, sales opportunities, and follow-up tasks. It has English and Georgian interface support, with `/en` and `/ka` routes. Default company settings use Asia/Tbilisi and GEL. Some interface labels remain in English. Customer-entered names and notes remain unchanged when the language switches.

The intended users are small and growing sales teams, especially Georgian and English teams. This audience is inferred from the design. There are no supplied market-research results or customer adoption metrics.

The workflow problem is scattered customer information, unclear opportunity progress, and missed follow-up responsibilities. The intended benefit is a shared view of customer relationships and sales work. No measured improvement in revenue, conversion, productivity, or cost is available.

### Working product capabilities

- Registration creates a company workspace, an administrator, default sales stages, and a trial subscription.
- Account flows include sign-in, sign-out, password reset, and email verification. Console email is the default. SMTP support needs configuration and testing for real delivery.
- Users can belong to several companies through memberships and switch workspaces.
- Admins manage company settings, members, roles, pipeline configuration, custom fields, subscription settings, and the recent audit panel.
- Managers can access all CRM records in their company and assign work.
- Employees primarily work with their own assigned records and create records for themselves.
- Customers have contact details, owners, associated contacts, notes, related deals, and custom fields. Customer lists support search and pagination. Customers can be soft archived.
- Customer custom field types are Text, Number, Date, and Select.
- Deals have board and list views, customer links, owners, amounts, currencies, expected close dates, stages, outcomes, linked tasks, and activity history.
- Default stages are New, Qualified, Proposal, Negotiation, Won, and Lost. Board cards change stage through a selection control. Drag-and-drop is not implemented.
- The dedicated close-deal action requires a reason for a Lost outcome. Do not claim all stage-change paths enforce that requirement.
- Tasks have an assignee, due date, optional description, optional customer/deal links, Open/Done status, completion, and reopening. There are overdue indicators and upcoming work lists. Automated email or push reminders are not implemented.
- The dashboard queries actual CRM records on page render. It shows active deals, pipeline amount by currency, Open tasks, wins this UTC month, up to 10 overdue tasks, up to 10 tasks due in the next seven days, and five recently updated customers.
- Active deals are unarchived Open opportunities. Pipeline value is the total amount of those opportunities, grouped by currency. It is not recognized revenue or a statistical forecast.
- The main CRM services use company-scoped queries and role/owner checks. Describe this as the implemented access model. Do not claim comprehensive security certification or flawless authorization.
- The administrator can view selected recent audit events. This is not a compliance certification.

### Technology and architecture

- One full-stack application using Next.js 15.5.28 App Router, React 19.1.0, and TypeScript.
- Server pages and server actions call domain services, which use Prisma 6 and SQLite.
- Styling uses Tailwind CSS 4 and custom CSS. Icons use lucide-react.
- Localization uses next-intl 4.
- Password hashing uses bcryptjs. Authentication uses a signed JWT cookie with session-table recording and a database-token fallback. Do not describe it as database-only sessions with guaranteed central revocation.
- Zod validates registration input, with manual validation elsewhere. Email transport uses Nodemailer.
- Vitest runs tests. ESLint and TypeScript provide static checks.
- A User joins a Company through a Membership containing its role. A Company contains Customers, Contacts, PipelineStages, Deals, Tasks, Notes, and AuditEvents. Deals connect opportunities to stages and related customer work. CustomFieldDefinitions describe per-customer values. Each Company has a Subscription referencing a Plan, with BillingEvents recording development billing activity.
- Money uses integer minor units such as tetri. Totals remain separate by currency, with no exchange-rate conversion.
- Dates use timestamps and company-timezone display. The monthly win metric uses a UTC month boundary.

### Subscription and demo facts

- The seeded Starter plan has limits of 10 users, 500 active customers, and 1,000 unarchived deals. Growth has 25 users, 2,000 customers, and 5,000 deals.
- Seeded trial duration is 14 days. These are configurable demo values.
- Subscription states are Trialing, Active, Past Due, Canceled, and Expired.
- Creation limits apply to member invitation/acceptance, customer creation, and deal creation. The current gate allows Past Due status. Do not invent a complete automatic trial-expiry lifecycle.
- Development webhooks verify HMAC-SHA256 signatures and check external event IDs to prevent repeat processing of previously stored events.
- Live payments and Stripe checkout are not implemented. Seed prices are placeholders, so omit prices from the main deck.
- Payment-state changes do not delete CRM data.
- Two seeded demonstration companies each have an Admin, Manager, and Employee. Sample records include customers, deals, tasks, notes, and an Industry custom field.
- Sample deal titles that mention SSO, ERP, or security audits are fictional sales opportunities. They are not features of this application.
- Vercel demo configuration and a bundled SQLite database exist. Temporary serverless storage is for demonstration. No public deployment URL has been verified.

### Verification and remaining work

On 24 October 2026, all 12 tests across six files passed, and TypeScript checking and lint passed. Both demo companies were present in the database. Tests cover specific permissions, tenant-scoped customer lookup, passwords, money, dates, slugs, and billing signature generation. They do not establish full end-to-end or security coverage. Do not claim a new successful build or browser test from this review.

The MVP requires production work: durable database storage, authentication and authorization hardening, replacement of demo secrets, restriction/removal of the unauthenticated demo-login route, session revocation behavior, real SMTP, payment integration, trial lifecycle completion, backups, monitoring, and retention decisions. PostgreSQL is proposed in documentation, but current schema and runtime initialization are SQLite-specific. A migration requires code and schema work.

Calendar, chat, documents, advanced automation, AI lead scoring, SSO, forecasting, and native mobile apps are not implemented. If mentioned at all, label them as optional future ideas rather than committed roadmap items.

## Required slide sequence

1. **CRM Solution**: Bilingual workspace for customer relationships and sales work. Presenter placeholder.
2. **The workflow problem**: Scattered information, unclear opportunity status, and follow-up responsibility.
3. **Who uses the workspace**: Likely team audience and the three user roles.
4. **One connected sales workflow**: Workspace setup, customer, deal, follow-up task, and outcome.
5. **Customer context in one profile**: Customer details, contacts, notes, related deals, search, and custom fields.
6. **Sales opportunities have visible stages**: Board/list views, stages, owners, amounts, and activity history.
7. **Follow-up work has an owner and due date**: Task links, completion, overdue, and upcoming work.
8. **The dashboard shows current CRM activity**: Metric definitions and currency-separated pipeline value.
9. **Roles define access within a company**: Compact permission table and company membership model.
10. **English and Georgian support daily use**: Language switching, locale routes, timezone, and preserved customer text.
11. **One full-stack application**: A simple UI, server, services, Prisma, and SQLite architecture diagram.
12. **Relational data connects the workflow**: Simplified entity relationships and the money-storage approach.
13. **Subscription foundations are implemented**: Starter/Growth limits, trial, states, and simulated billing. Mark live payments as future work.
14. **A working MVP with production work remaining**: Verified tests and typecheck, plus a clearly separated list of production priorities.
15. **Demonstration and questions**: Customer profile, deal stage change, linked task completion, dashboard refresh, and Georgian language switch.

## Visual and writing requirements

- Use 16:9 widescreen slides with large, readable text and generous spacing.
- Match the application's visual style: dark navy `#05080D`, emerald `#10B981`, cyan `#06B6D4`, white `#F8FAFC`, and muted slate `#8B9BB4`.
- Use a modern readable font, with Georgian glyph support if Georgian examples appear.
- Give each slide one clear purpose. Keep slide text concise, generally three to five short points or an equivalent diagram/table.
- Favor real product screenshots when supplied. If no screenshots exist, use clearly labeled screenshot placeholders or conceptual diagrams. Do not fabricate an image and present it as the actual application.
- Use a customer-profile visual, pipeline board, task view, dashboard, role table, architecture diagram, and a simplified data-model diagram where appropriate.
- Label every illustrative CRM amount or sample record as demo data. Do not turn seeded opportunities into company revenue or traction claims.
- Explain technical terms in plain language. Avoid slogans, filler, stock phrases, and unsupported superlatives.
- Keep technical caveats in speaker notes where possible, while clearly stating MVP status and remaining production work on slide 14.
- Add discreet repository source references in notes if the reference brief is available.
- Do not invent customers, testimonials, team members, timelines, market size, investment needs, performance benchmarks, completed integrations, compliance claims, or production deployment status.

## Output requirements

Create the presentation in the format your tool supports. Include concise on-slide copy, a useful visual on each slide where appropriate, and approximately 50–80 words of speaker notes per slide. Use fewer words where the slide needs little explanation. Also provide a 30-second opening script and a short demonstration script. Ensure the notes and visible claims agree with the supplied project facts.
