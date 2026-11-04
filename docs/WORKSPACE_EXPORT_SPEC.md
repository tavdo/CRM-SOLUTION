# Workspace export v2

The original CRM payload and administrator browser-download destination were explicitly approved on 2026-10-28. The contractor refactor adds construction records to JSON v2 while retaining the same administrator capability, destination, streaming and secret exclusions. Implemented locally in `src/lib/services/export.ts` and `src/app/api/workspace/export/route.ts`, with downloads in Settings. No deployment or live data download was performed.

## Access and destination

Add an explicit `company.export` capability granted only to ADMIN. Check it both at the route and service before any query. The authenticated administrator downloads the active workspace's file through their browser from Settings. No email, cloud storage, third-party upload, or automatic recurring export is proposed. Responses use `private, no-store` and attachment headers.

## JSON payload

Use a versioned JSON envelope with `schemaVersion: 2`, `exportedAt`, workspace ID, and arrays with original stable IDs. Preserve foreign keys for reconstructing relationships, integer minor-unit amounts, currency, and ISO timestamps. Include archived records.

| Array | Proposed fields/categories |
| --- | --- |
| workspace | ID, name, slug, locale, timezone, currency, legal form, VAT flag, tax ID, address, phone, saved bank IBANs |
| customers | IDs, owner ID, original name, business identity, contact details, address, saved customer IBAN, archive and timestamps |
| contacts | IDs, customer and owner IDs, name, email, phone, title, archive and timestamps |
| leads | IDs, contact/business details, source, status, amount/currency, notes, owner and converted-record IDs, timestamps |
| pipelineStages | IDs, names, ordering, won/lost flags, archive and timestamps |
| deals | IDs and links, title, amount/currency, owner, stage, dates, status, loss reason, archive and timestamps |
| tasks | IDs and links, title, description, checklist, status, priority, due/completion timestamps, owner/creator IDs |
| products | IDs, SKU, description, units, price/currency, VAT metadata, active flag, timestamps |
| invoices | IDs and links, number, manual status, dates, integer totals/tax metadata, bank preference, internal RS.ge reference, notes |
| invoiceItems | ID, invoice/product IDs, description, quantity, unit, integer unit price and total |
| notes | IDs, body, author ID, customer/contact/deal links, timestamps |
| customFields / customValues | IDs, definitions/options and customer-linked values |
| memberships | IDs, user ID, role, department/job title, timestamps |
| users | Only ID, name, email for current workspace members |
| constructionProjects | IDs, client/deal links, site address, responsible members, dates, status, currency and contract reference |
| constructionEstimates / estimateLines | Version/status/rates, decimal quantities and separate integer material/labor/subcontract/equipment/other prices |
| projectCosts / projectChanges | Categories, integer amounts, dates and approval states |
| siteReports / projectDocuments | Site reports and private document metadata; no file bytes or storage paths |
| tradePartners | Supplier/subcontractor names, specialization, business contact details |
| materialRequests / supplyQuotes / purchaseOrders / stockMovements | Project/product/partner links, exact quantities, integer prices, receipt and movement values |
| subcontracts / subcontractProgress | Agreements and confirmed quantities |
| workAcceptances / acceptanceLines | Manual confirmation status, quantities, prices, integer net/tax/totals |
| projectPayments | Manual receipt/outflow entries, stages, amounts, dates and optional subcontract allocation |

These files contain personal and financial data. They become locally accessible to whoever can access the downloaded file. Exact database selectors must use explicit field allowlists so future schema additions cannot silently expand the payload.

Excluded: private document storage keys and bytes, internal idempotency keys, password hashes, credentials, sessions, invitation/reset/verification tokens, provider secrets, billing callback payloads and identifiers, audit details, feed/chat, HR/work logs/leave requests, automation rules/execution history, and all other workspaces. References to removed users may remain unresolved and must be reported by future import preview.

## CSV

Offer a separate customers-only CSV: ID, workspace ID, name, tax ID, legal form, VAT flag, email, phone, website, address, owner ID, archive timestamp. UTF-8 with BOM, CRLF, quoted cells with escaped quotes. Prefix formula-like text and leading tab/newline content with an apostrophe. JSON remains the lossless representation; CSV formula protection intentionally changes dangerous cell text.

## Scalability, audit, and acceptance

Use bounded pages of 200 rows and streaming with backpressure; scope every page by the authenticated workspace, and invoice items through their parent invoice. Audit request/completion/failure/cancellation with format/version only, never exported personal data. A failed stream is incomplete and must not claim completion.

Initial paginated live reads are not a transactionally consistent backup while concurrent writes occur. Document this limitation in Settings and the JSON envelope. A later background snapshot job is required before promising consistency or large-export completion within hosting timeouts.

Regression coverage includes deterministic isolated-database tests for employee/manager denial, direct route denial, tenant isolation across every included array, stable relationships, multiple pages, Georgian round-trip, formula injection, secret exclusion, cancellation and failure audit behavior. Tests use synthetic fixtures in a temporary database.
