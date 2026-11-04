# Omnichannel Inbox

Implemented in the existing Next.js App Router application, Prisma/SQLite, React and EN/KA UI. Channels are plugins under `src/lib/inbox/adapters`; team chat remains separate. The existing public web form is unchanged.

## Local setup

Requires Node.js 22+, a supported Redis server, and an HTTPS tunnel for provider callbacks. Redis is **not** embedded in Next.js.

1. Back up your local SQLite database. Run `npm install`, `npm run db:deploy` and `npm run db:generate`. Migrations preserve CRM records. Never reset an existing database to install the inbox.
2. Generate a dedicated key with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Save the result as `INBOX_ENCRYPTION_KEY` in `.env`; do not commit it. Keep a backup of this key. It encrypts both account credentials and persisted webhook bodies; changing it requires a deliberate re-encryption migration.
3. Set `META_GRAPH_VERSION` to a version supported by your Meta app (the example pins `v24.0`), `REDIS_URL=redis://127.0.0.1:6379`, and `INBOX_STORAGE=local`.
4. Run `docker compose -f compose.inbox.yaml up -d`. An existing Redis service works too. Redis persistence must be enabled and its eviction policy must be `noeviction`.
5. Run `npm run dev` and, in another terminal, `npm run inbox:worker`. The web application durably saves events even when Redis is unavailable. A running worker is required to process them or send queued replies.
6. Sign in as an administrator. Open `/en/settings/channels` or `/ka/settings/channels`. An employee has no inbox access; managers see only assigned conversations.

Optional: `npm run inbox:seed` creates an isolated **Inbox Sandbox** workspace with four disconnected sample channels and one shared contact. It does not change the main workspace's CRM records or contact any provider. Switch workspace in the sidebar, then open `/en/inbox`. Sample channels cannot send messages. The ordinary workspace seed still creates no sample CRM records.

## HTTPS tunnel

Use one of these in a separate terminal:

```sh
ngrok http 3000
# or
cloudflared tunnel --url http://localhost:3000
```

Set `APP_URL` in `.env` to the resulting **HTTPS** URL and restart the app and worker. Copy webhook URLs from Channel settings. Update provider registrations whenever the tunnel URL changes. Authentication testing in a tunnel may require signing in on that hostname; localhost cookies do not transfer to another domain.

Only the webhook endpoints are unauthenticated. Their signatures authenticate the raw body. CRM APIs and private attachment downloads require a current workspace session and inbox authorization. Outbound media uses a 30-minute signed link because the provider must fetch the file; it is not a permanent public URL.

## Meta app and Facebook Messenger — stage (a)

1. In Meta for Developers create an app with the Messenger use case. Connect a Facebook Page you administer. Obtain the app secret and a Page access token with the messaging/metadata permissions required by your app's current API version.
2. In CRM Channel settings choose **Facebook Messenger**. Enter the Page ID, token, app secret, a readable name, and a verify token of at least 16 characters. Record your verify token. Secrets are encrypted at rest; the settings API never returns saved access tokens or app secrets.
3. In Meta Webhooks register the CRM URL `/api/inbox/webhooks/meta/<integrationId>` and the same verify token. The GET challenge endpoint compares its hash and echoes the challenge.
4. Subscribe the Page/app to `messages`, `message_echoes`, `message_deliveries`, `message_reads`, and the postback events needed by your use case. Field availability can vary by app/API version. Registering a callback alone does not subscribe the Page.
5. Click **Check connection**. This verifies the account/token API call; it does not prove webhook delivery or app-review approval.
6. Apps in development mode are limited to eligible app/Page roles and test accounts. Complete Meta's required business verification, access review and live-mode setup before expecting messages from general customers.

Manual test:

- Send a text and image from an eligible personal account to the Page. The webhook should return 200 quickly; the worker creates a Contact, Lead, conversation and message history.
- Open the inbox and reply within the permitted messaging window. Observe `QUEUED → SENT → DELIVERED/READ` as provider callbacks arrive. Unavailable receipts are not fabricated.
- Replay the same raw signed webhook. Verify one message and no extra contact/lead. Tamper with a byte and verify 401.
- Stop the worker; send another message. Confirm an event remains pending. Restart the worker and verify ingestion resumes.
- Open the Contact's Messages view, then convert its Lead. The same contact and full history must remain linked to the resulting client.

## Instagram Direct — stage (b)

This adapter uses **Instagram API with Facebook Login**, not Instagram Login. Use an eligible Business/Creator account linked to your Facebook Page and the corresponding Page token, messaging permissions and review approvals.

Choose **Instagram Direct**, enter the Instagram professional account ID, and select the **existing Meta app connection** when it shares the app used by Messenger. The channels share that app's webhook URL and original verify token. Subscribe the Instagram messaging events in Meta. Do not mix an Instagram Login token with the Facebook Login configuration.

Manual test: send a DM and image, reply, then read the reply on Instagram. Verify the IG-scoped identity is separate from a Messenger Page-scoped identity. Contacts are combined only by an unambiguous phone match or an explicit admin merge. File types unsupported by Instagram fail explicitly.

## WhatsApp Cloud — stage (c)

Create/use a Meta business portfolio, WhatsApp Business Account and Cloud API phone number. Use the **phone number ID**, not the displayed phone number or WABA ID, when connecting the channel. Supply an authorized access token and reuse the appropriate Meta app connection. Subscribe the app to the WABA and the `messages` webhook field. Use Meta's test recipient setup while developing.

The last inbound customer-message timestamp controls the rolling 24-hour window. Free-form replies and media are checked both when queued and again before dispatch. Outside the window, choose **Template** and enter an approved template name, exact language code and optional body-text parameters (one per line). Sending a template alone does not reopen the free-form service window; a new customer message does. Media-header/button templates are not currently exposed by the composer.

Manual test: receive a text/media message from a permitted test number; verify its normalized phone matches the correct same-workspace Contact. Reply inside the window, then use a fixture/staging conversation older than 24 hours to verify free-form replies are rejected and an approved template is accepted. Replay sent/delivered/read callbacks out of order and confirm status never regresses. Cloud media IDs are resolved by the worker, downloaded with authorization and stored privately before the expiring URL becomes unusable.

## Viber Bot — stage (d)

Viber Bot access requires Viber's commercial onboarding. This is the **Bot API**, not a Business Messages provider integration. Obtain the bot authentication token and account ID. Connect **Viber Bot**, then click **Check connection**. After verifying the account ID, CRM calls `set_webhook` with its HTTPS URL and delivery/subscription events. The callback is verified with HMAC-SHA256 and `X-Viber-Content-Signature` using the bot token. Viber message tokens are parsed losslessly as strings.

Manual test: open/subscribe to the bot, send a message, reply from CRM and read it. Verify delivery/seen callbacks and replay the same event. Unsubscribe and confirm sends are refused. **Disconnect** pauses local sending and attempts to remove the provider webhook; a remote-removal error is displayed if Viber is unavailable. External media hosts outside the supported provider CDN allowlist are marked failed rather than fetched unsafely.

## Workflow polish — stage (e)

- Use search, channel/status/manager filters and **Unread only**. Unread state belongs to each CRM user; reading as admin does not mark a manager's messages read.
- Set agents **Available** to opt into round-robin assignment. Only current admin/manager members who opted in are eligible. If nobody is available, the conversation stays unassigned. **Take conversation** claims the oldest unassigned active conversation atomically. Admins may reassign; managers cannot browse another manager's conversations through the inbox, search, attachment URLs or contact timeline.
- **Internal notes** have a separate table and API action and are never sent to a provider. Switch back to Messages to reply externally.
- Administrators can add quick replies in Channel settings. An exact normalized phone match suggests duplicate contacts in the chat header. For duplicates without a phone match, open the contact card's **Merge duplicate contact**, search for the contact to keep, preview and confirm. Identities, conversations, CRM notes, deals and leads move in one transaction; the source is archived and the merge audited. Conflicting client links must be resolved first. Names alone do not trigger automatic merges.
- Configure welcome and away text per channel. Blank text disables that reply. Working hours use the configured IANA timezone and weekdays. Welcome is scheduled once per conversation; away replies are throttled to once per 24 hours. Echoes, receipts and duplicate deliveries never trigger auto-replies. Automated sends obey channel messaging rules.
- Messages tabs in contact/lead/client cards show a unified timeline across linked channels while retaining the same inbox authorization. The timeline shows the newest 100 messages; the inbox loads message history in pages of 50.
- SSE sends scoped invalidations, checks the session/membership repeatedly, and reconnects periodically. Each reconnect refetches current database state, so missed notifications do not lose message history. Configure your reverse proxy to disable buffering on `/api/inbox/events`.

Manual test: use two managers, assign different conversations, and try opening each other's IDs. Confirm 404 with no message content. Add a note, change status, take/reassign a conversation, merge duplicates, check both themes at phone/desktop widths, and test a configured away reply outside business hours. Fixtures are disconnected by default and never send automatically.

## Reliability, storage and operations

- Webhook handlers verify the raw request before parsing, enforce a 1 MiB body limit, deduplicate payloads and persist encrypted events plus a transactional outbox before acknowledging. Message-level unique `(channelId, externalMessageId)` constraints handle rebatched/reordered duplicates too.
- BullMQ jobs reference database IDs. The worker retries up to five times with exponential backoff and jitter. Dispatch failures retain pending outbox rows. Retain Redis AOF data; do not treat Redis as an evictable cache. Terminal failed webhook jobs appear in Channel settings and can be replayed by an administrator.
- A send interrupted after provider submission can have an unknown result. Such messages become **UNCERTAIN**; they are not blindly repeated. Reconcile against the provider before composing a new reply. A provider that lacks idempotency keys cannot offer a universal exactly-once send guarantee.
- API errors/logs contain stable codes, not raw provider responses, URLs, credentials or webhook bodies. Provider acceptance produces SENT, not DELIVERED. Read/delivery events advance status monotonically.
- Basic limits: 2,000 accepted webhook payloads/integration/minute, 30 manual sends/user/minute, 20 recent draft uploads/user/hour, a 20 MiB media cap, and a global worker limiter. Add gateway request limits for your production traffic profile. Invalid signatures are never stored.
- Local files live under `storage/inbox/<companyId>` outside `public`. Outbound previews use allowlisted inline MIME types; other files download with `nosniff` and sandbox headers. Incoming downloads permit HTTPS provider CDN hosts only and revalidate every redirect; arbitrary URLs and credentials in URLs are rejected. Expired/unavailable/oversized attachments show an explicit failure state.
- For production set `INBOX_STORAGE=s3`, `S3_BUCKET`, `AWS_REGION`, and optional `S3_ENDPOINT`. The AWS default credential chain supports an IAM role or environment credentials; never place credentials in tracked configuration. Buckets must be private. Back up the DB, media and encryption key together. Draft uploads and retained encrypted webhook events currently need operator-managed retention/cleanup; no automatic deletion of customer history is performed.
- Run the web app and worker on persistent infrastructure. SQLite local development uses worker concurrency one. A small single-host SQLite deployment needs shared durable disk and backups; multi-host production should use PostgreSQL with its own migration baseline and data migration. Do not run SQLite-specific migration SQL against PostgreSQL. The existing ephemeral Vercel demo is not durable inbox hosting.
- `/api/health` checks inbox schema availability. Channel settings shows undispatched jobs and failed webhook events. Monitor the worker process, Redis and outbox age separately; database health alone does not prove provider delivery.
- Reconnect a Meta account using its original app connection to preserve channel IDs and history. Rotating a Meta app secret currently requires an operator to update the encrypted integration credentials; OAuth onboarding/automatic token renewal are outside this implementation.

## Automated verification

```sh
npm run test:inbox
npm test
npm run typecheck
npm run build
```

Fixtures are under `tests/fixtures/inbox`. Tests run in isolated SQLite databases with fake HTTP transport; they never call a real customer. They cover signatures, channel parsing, Viber numeric IDs, phone matching, encryption, idempotency, authorization, queue outages, send retries, unknown send results, delivery ordering and contact merges. Live end-to-end verification still requires actual account approvals/tokens and a running Redis/worker pair.

Primary references: [Meta Messenger](https://www.postman.com/meta/messenger-platform-api/collection/iyp204x/messenger-platform-api), [Meta Instagram](https://www.postman.com/meta/instagram/collection/6yqw8pt/instagram-api), [Meta WhatsApp](https://www.postman.com/meta/whatsapp-business-platform/overview), [Viber Bot API](https://developers.viber.com/docs/api/rest-bot-api/), [BullMQ](https://docs.bullmq.io/guide/retrying-failing-jobs).
