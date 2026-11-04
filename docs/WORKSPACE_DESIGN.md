# CRM workspace design

The authenticated workspace follows the supplied Bitrix24 layout: translucent sidebar navigation, work panels, Kanban stages, a utility rail, a settings popover and language/theme controls. Module links appear in the sidebar and mobile drawer; the top bar contains header actions without duplicate module links. The supplied CRM Solution logo appears in the desktop brand area and mobile header. Branding uses the supplied blue palette: royal blue `#0000e2`, hover blue `#0003d4`, secondary blue `#00008b`, navy `#000175` and deep navy `#00025f`. Day mode uses muted blue-gray panels (`#c9d6e7`) with softer inset areas and slightly lighter inputs, avoiding bright white cards. Night mode has dark navy panels with lighter blue text and accents.

The same shell and scoped visual tokens apply to existing CRM, task, calendar, project, invoice and settings routes. The public landing page shares the logo and blue branding while retaining its mountain photo. Authentication pages use the same primary brand colors. The schema is unchanged. Construction workflows remain available through Projects; the subsequent user-approved demo cleanup removes the old sample records.

## Clean starting workspace

The user explicitly selected three accounts and deletion of demo data. The packaged database contains one CRM Workspace and exactly one administrator, manager and user account, with no sample CRM, construction, HR, chat or feed records. See README for logins. Default sales stages are general CRM stages. The former Alpha/Beta generators are removed, and the production runtime uses a new database filename so old container copies do not restore retired identities.

Maintenance deletes only the two exact legacy tenant IDs/slugs and the six fixed legacy identities. It checks cross-tenant ownership/references before deleting, keeps foreign keys enabled, deletes children before parents, removes corresponding private local files and compacts SQLite. Request startup only adds missing bootstrap accounts when enabled; it performs no destructive cleanup. A separate non-demo workspace in the local developer database is preserved.

## Working overview

The primary dashboard now summarizes general CRM activity. It reports open deals, pipeline amounts separately per currency, new leads, open/overdue tasks, stage counts, all-time won/lost counts and win rate, recent deals/customers, task deadlines and lead sources. Every query uses the active workspace and the current role's owner scope. Task previews select no linked customer/deal information. Empty data has an explicit empty state; zero closed deals shows no win rate.

Deal filters support title search, stage and status. Switching between board and list retains filters. Pipeline tiles link to the corresponding filtered sales view. Utility buttons, creation links and settings menu items navigate to implemented routes; badges use actual record counts. Invitation links are shown only for users who can manage members.

The sidebar collapses on desktop. On mobile it becomes a modal drawer with focus containment, Escape dismissal and focus restoration. Tables and Kanban columns scroll within their work area. Reduced-motion preferences are respected. Georgian and English copy is included.

## Validation

- All 80 tests pass. Coverage includes overview owner/tenant isolation, per-currency totals, combinations of sales filters, clean bootstrap/idempotency, cleanup of restrictive construction dependencies and preservation of non-demo data.
- ESLint and TypeScript checks pass; `npm run build` completes successfully.
- Browser checks cover desktop navigation, deal search and list/board filter retention, Georgian/English, day/night selection and the mobile drawer at 390 × 844. Page width stays within the viewport; wide tables scroll inside their panels.

## Wallpaper provenance

- Authenticated CRM pages: user-supplied `customer-relationship-management-concept.jpg`, optimized to `public/images/dashboard-crm.webp` (2400 × 1602, approximately 160 KB). The source file is unchanged. All authenticated routes share this photo, with lighter tint in the middle so the image remains visible and darker edges for heading/footer contrast.
- Header logo: user-supplied `Firefly_Gemini Flash_remove background 428947.png`, with the baked-in checkerboard removed using imagegen and transparent output stored as `public/images/crm-logo.png`.
- The landing page retains `public/images/landing-mountains.jpg`. The original generated wallpaper below is retained as an unused asset.
- Mode: original image generation (`image_gen.imagegen`), no reference image editing.
- Asset: `public/images/crm-workspace-v1.png`.
- Prompt: “Use case: stylized-concept. Asset type: wide desktop wallpaper background for a working business CRM dashboard, not a UI mockup. Create an original premium 3D abstract translucent glass flower with large flowing curled petals and fluid glass ribbons. Deep indigo-violet and royal blue background, luminous cyan and icy blue highlights inside the flower, subtly pearlescent reflective glass surfaces, thin bright curved glass edges and tiny cyan light particles. Main flower occupies the right half and extends off the right and bottom edges; the entire left half and top-left are calm mostly flat indigo (#38348d) with a soft diffuse violet gradient, suitable for overlaying navigation and application text. Broad horizontal 16:9 composition. Rich atmospheric soft light, fine realistic refractive caustics, restrained detail, smooth rendering. No lettering, no typography, no logos, no people, no interface elements, no watermarks. This image must only be the wallpaper.”

## Scope of the broader platform request

This design delivery does not establish full Bitrix24 feature parity. Existing leads, customers, deals, products/services, invoices/quotes, tasks, calendar, web forms, limited task automation, workspace permissions and administrator export remain functional. General project collaboration, internal messaging/feed, HR/time tracking, booking resources, document knowledge bases, recurring deals, a public API/app marketplace and advanced automation still require implementation. Construction-specific Projects remain a specialist workflow, not a general project manager.

AI, WhatsApp, email marketing, telephony, payments, legally meaningful electronic signatures and directory synchronization need their respective services and configuration. Storage quotas, durable production storage, backups, encryption at rest, server clusters, load balancing, compliance attestations and support commitments require infrastructure and operational work. They are not represented as working features by decorative dashboard buttons.
