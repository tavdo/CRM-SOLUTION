-- CreateTable
CREATE TABLE "InboxIntegration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentialsEncrypted" TEXT NOT NULL,
    "verifyTokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InboxChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "credentialsEncrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastCheckedAt" DATETIME,
    "lastError" TEXT,
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxChannel_integrationId_companyId_fkey" FOREIGN KEY ("integrationId", "companyId") REFERENCES "InboxIntegration" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboxConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "externalChatId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "leadId" TEXT,
    "assignedUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subscribed" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastIncomingAt" DATETIME,
    "welcomeSentAt" DATETIME,
    "awaySentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InboxConversation_channelId_companyId_fkey" FOREIGN KEY ("channelId", "companyId") REFERENCES "InboxChannel" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InboxConversation_contactId_companyId_fkey" FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InboxConversation_leadId_companyId_fkey" FOREIGN KEY ("leadId", "companyId") REFERENCES "Lead" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "clientRequestId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "errorCode" TEXT,
    "sentByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerTimestamp" DATETIME,
    CONSTRAINT "InboxMessage_conversationId_companyId_fkey" FOREIGN KEY ("conversationId", "companyId") REFERENCES "InboxConversation" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "phone" TEXT,
    CONSTRAINT "ContactIdentity_channelId_companyId_fkey" FOREIGN KEY ("channelId", "companyId") REFERENCES "InboxChannel" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContactIdentity_contactId_companyId_fkey" FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboxInternalNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxInternalNote_conversationId_companyId_fkey" FOREIGN KEY ("conversationId", "companyId") REFERENCES "InboxConversation" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboxAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sourceEncrypted" TEXT,
    "storageKey" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    CONSTRAINT "InboxAttachment_messageId_companyId_fkey" FOREIGN KEY ("messageId", "companyId") REFERENCES "InboxMessage" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboxWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "payloadEncrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxWebhookEvent_integrationId_companyId_fkey" FOREIGN KEY ("integrationId", "companyId") REFERENCES "InboxIntegration" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboxOutboxEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "dispatchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InboxReadCursor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxReadCursor_conversationId_companyId_fkey" FOREIGN KEY ("conversationId", "companyId") REFERENCES "InboxConversation" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboxAgent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "lastAssignedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00 +00:00'
);

-- CreateTable
CREATE TABLE "InboxQuickReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "contactId" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "companyName" TEXT,
    "taxId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "source" TEXT NOT NULL DEFAULT 'FACEBOOK',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "amountMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "notes" TEXT,
    "ownerId" TEXT,
    "convertedCustomerId" TEXT,
    "convertedDealId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_contactId_companyId_fkey" FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("amountMinor", "companyId", "companyName", "contactName", "convertedCustomerId", "convertedDealId", "createdAt", "currency", "email", "id", "notes", "ownerId", "phone", "source", "status", "taxId", "title", "updatedAt") SELECT "amountMinor", "companyId", "companyName", "contactName", "convertedCustomerId", "convertedDealId", "createdAt", "currency", "email", "id", "notes", "ownerId", "phone", "source", "status", "taxId", "title", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE INDEX "Lead_companyId_status_idx" ON "Lead"("companyId", "status");
CREATE INDEX "Lead_companyId_source_idx" ON "Lead"("companyId", "source");
CREATE UNIQUE INDEX "Lead_id_companyId_key" ON "Lead"("id", "companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InboxIntegration_companyId_status_idx" ON "InboxIntegration"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InboxIntegration_id_companyId_key" ON "InboxIntegration"("id", "companyId");

-- CreateIndex
CREATE INDEX "InboxChannel_companyId_status_idx" ON "InboxChannel"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InboxChannel_id_companyId_key" ON "InboxChannel"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxChannel_integrationId_type_externalAccountId_key" ON "InboxChannel"("integrationId", "type", "externalAccountId");

-- CreateIndex
CREATE INDEX "InboxConversation_companyId_assignedUserId_status_lastMessageAt_idx" ON "InboxConversation"("companyId", "assignedUserId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "InboxConversation_companyId_contactId_lastMessageAt_idx" ON "InboxConversation"("companyId", "contactId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "InboxConversation_companyId_leadId_idx" ON "InboxConversation"("companyId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxConversation_id_companyId_key" ON "InboxConversation"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxConversation_channelId_externalChatId_key" ON "InboxConversation"("channelId", "externalChatId");

-- CreateIndex
CREATE INDEX "InboxMessage_conversationId_direction_createdAt_idx" ON "InboxMessage"("conversationId", "direction", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboxMessage_id_companyId_key" ON "InboxMessage"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxMessage_channelId_externalMessageId_key" ON "InboxMessage"("channelId", "externalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxMessage_companyId_clientRequestId_key" ON "InboxMessage"("companyId", "clientRequestId");

-- CreateIndex
CREATE INDEX "ContactIdentity_companyId_contactId_idx" ON "ContactIdentity"("companyId", "contactId");

-- CreateIndex
CREATE INDEX "ContactIdentity_companyId_phone_idx" ON "ContactIdentity"("companyId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "ContactIdentity_channelId_externalUserId_key" ON "ContactIdentity"("channelId", "externalUserId");

-- CreateIndex
CREATE INDEX "InboxInternalNote_companyId_conversationId_createdAt_idx" ON "InboxInternalNote"("companyId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "InboxAttachment_companyId_messageId_idx" ON "InboxAttachment"("companyId", "messageId");

-- CreateIndex
CREATE INDEX "InboxWebhookEvent_status_createdAt_idx" ON "InboxWebhookEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboxWebhookEvent_integrationId_digest_key" ON "InboxWebhookEvent"("integrationId", "digest");

-- CreateIndex
CREATE INDEX "InboxOutboxEvent_dispatchedAt_createdAt_idx" ON "InboxOutboxEvent"("dispatchedAt", "createdAt");

-- CreateIndex
CREATE INDEX "InboxOutboxEvent_companyId_createdAt_idx" ON "InboxOutboxEvent"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboxOutboxEvent_kind_recordId_key" ON "InboxOutboxEvent"("kind", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxReadCursor_conversationId_userId_key" ON "InboxReadCursor"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "InboxAgent_companyId_available_lastAssignedAt_idx" ON "InboxAgent"("companyId", "available", "lastAssignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboxAgent_companyId_userId_key" ON "InboxAgent"("companyId", "userId");

-- CreateIndex
CREATE INDEX "InboxQuickReply_companyId_idx" ON "InboxQuickReply"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_id_companyId_key" ON "Contact"("id", "companyId");
