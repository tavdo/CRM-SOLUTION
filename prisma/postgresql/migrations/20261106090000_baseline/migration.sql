-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "crm";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "preferredLocale" TEXT NOT NULL DEFAULT 'en',
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerifyToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerifyToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tbilisi',
    "defaultLocale" TEXT NOT NULL DEFAULT 'ka',
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "taxId" TEXT,
    "legalForm" TEXT NOT NULL DEFAULT 'შპს',
    "isVatPayer" BOOLEAN NOT NULL DEFAULT true,
    "bogIban" TEXT,
    "tbcIban" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "departmentName" TEXT,
    "jobTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "tokenHash" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "legalForm" TEXT DEFAULT 'შპს',
    "isVatPayer" BOOLEAN NOT NULL DEFAULT true,
    "bankIban" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "ownerId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "ownerId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fieldType" "CustomFieldType" NOT NULL,
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueDate" TIMESTAMP(3),

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "customerId" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customerId" TEXT,
    "contactId" TEXT,
    "stageId" TEXT NOT NULL,
    "ownerId" TEXT,
    "amountMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "expectedCloseAt" TIMESTAMP(3),
    "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "lossReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealActivity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "phase" TEXT,
    "constructionKey" TEXT,
    "projectId" TEXT,
    "plannedQuantity" TEXT,
    "workUnit" TEXT,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "boardStage" TEXT NOT NULL DEFAULT 'TODO',
    "checklistJson" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "customerId" TEXT,
    "dealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "contactId" TEXT,
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'ცალი',
    "priceMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "vatIncluded" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "vatRateBps" INTEGER,
    "projectId" TEXT,
    "acceptanceId" TEXT,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dealId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "vatRate" INTEGER NOT NULL DEFAULT 18,
    "vatMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "includeVat" BOOLEAN NOT NULL DEFAULT true,
    "bankPreference" TEXT NOT NULL DEFAULT 'BOG_TBC',
    "rsGeWaybillRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'ცალი',
    "unitMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedPost" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'ANNOUNCEMENT',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'general',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headName" TEXT,
    "parentName" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WORKING',
    "clockInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOutAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL DEFAULT 'VACATION',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerStageId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL DEFAULT 'CREATE_TASK',
    "actionDetail" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "interval" TEXT NOT NULL DEFAULT 'month',
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxCustomers" INTEGER NOT NULL DEFAULT 100,
    "maxDeals" INTEGER NOT NULL DEFAULT 200,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "lastPaymentFailureAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'dev',
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionProject" (
    "stage" TEXT NOT NULL DEFAULT 'ESTIMATE',
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dealId" TEXT,
    "address" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "description" TEXT,
    "managerId" TEXT NOT NULL,
    "siteLeadId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "contractNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionEstimate" (
    "operationKey" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "markupBps" INTEGER NOT NULL DEFAULT 0,
    "vatBps" INTEGER NOT NULL DEFAULT 0,
    "extraMinor" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConstructionEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateLine" (
    "subcontractUnitMinor" INTEGER NOT NULL DEFAULT 0,
    "equipmentUnitMinor" INTEGER NOT NULL DEFAULT 0,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "materialUnitMinor" INTEGER NOT NULL,
    "laborUnitMinor" INTEGER NOT NULL,
    "otherUnitMinor" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EstimateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCost" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "operationKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectChange" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "plannedCostMinor" INTEGER NOT NULL,
    "netRevenueMinor" INTEGER NOT NULL,
    "vatBps" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "authorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PROGRESS',
    "body" TEXT NOT NULL,
    "completedQuantity" TEXT NOT NULL DEFAULT '0',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "operationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradePartner" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "specialty" TEXT,
    "phone" TEXT,
    "email" TEXT,

    CONSTRAINT "TradePartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyQuote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "unitMinor" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "unitMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "valueMinor" INTEGER NOT NULL DEFAULT 0,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "kind" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "otherProjectId" TEXT,
    "operationKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcontract" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "unitMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subcontract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractProgress" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subcontractId" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkAcceptance" (
    "operationKey" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "vatBps" INTEGER NOT NULL DEFAULT 0,
    "netMinor" INTEGER NOT NULL,
    "vatMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceptanceLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "acceptanceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "unitMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,

    CONSTRAINT "AcceptanceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPayment" (
    "subcontractId" TEXT,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "operationKey" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxIntegration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentialsEncrypted" TEXT NOT NULL,
    "verifyTokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxChannel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "credentialsEncrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxConversation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "externalChatId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "leadId" TEXT,
    "assignedUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subscribed" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastIncomingAt" TIMESTAMP(3),
    "welcomeSentAt" TIMESTAMP(3),
    "awaySentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerTimestamp" TIMESTAMP(3),

    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactIdentity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "phone" TEXT,

    CONSTRAINT "ContactIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxInternalNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxInternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxAttachment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sourceEncrypted" TEXT,
    "storageKey" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,

    CONSTRAINT "InboxAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxWebhookEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "payloadEncrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxOutboxEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxReadCursor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxReadCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxAgent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "lastAssignedAt" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 00:00:00 +00:00',

    CONSTRAINT "InboxAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxQuickReply" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "InboxQuickReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerifyToken_tokenHash_key" ON "EmailVerifyToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerifyToken_userId_idx" ON "EmailVerifyToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_companyId_userId_key" ON "Membership"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_companyId_email_idx" ON "Invitation"("companyId", "email");

-- CreateIndex
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

-- CreateIndex
CREATE INDEX "Customer_companyId_name_idx" ON "Customer"("companyId", "name");

-- CreateIndex
CREATE INDEX "Customer_companyId_archivedAt_idx" ON "Customer"("companyId", "archivedAt");

-- CreateIndex
CREATE INDEX "Customer_companyId_ownerId_idx" ON "Customer"("companyId", "ownerId");

-- CreateIndex
CREATE INDEX "Contact_companyId_lastName_firstName_idx" ON "Contact"("companyId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "Contact_companyId_phone_idx" ON "Contact"("companyId", "phone");

-- CreateIndex
CREATE INDEX "Contact_companyId_customerId_idx" ON "Contact"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "Contact_companyId_ownerId_idx" ON "Contact"("companyId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_id_companyId_key" ON "Contact"("id", "companyId");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_companyId_sortOrder_idx" ON "CustomFieldDefinition"("companyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_companyId_key_key" ON "CustomFieldDefinition"("companyId", "key");

-- CreateIndex
CREATE INDEX "CustomFieldValue_companyId_customerId_idx" ON "CustomFieldValue"("companyId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldValue_fieldId_customerId_key" ON "CustomFieldValue"("fieldId", "customerId");

-- CreateIndex
CREATE INDEX "Note_companyId_customerId_idx" ON "Note"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "Note_companyId_dealId_idx" ON "Note"("companyId", "dealId");

-- CreateIndex
CREATE INDEX "PipelineStage_companyId_sortOrder_idx" ON "PipelineStage"("companyId", "sortOrder");

-- CreateIndex
CREATE INDEX "Deal_companyId_stageId_idx" ON "Deal"("companyId", "stageId");

-- CreateIndex
CREATE INDEX "Deal_companyId_status_idx" ON "Deal"("companyId", "status");

-- CreateIndex
CREATE INDEX "Deal_companyId_ownerId_idx" ON "Deal"("companyId", "ownerId");

-- CreateIndex
CREATE INDEX "Deal_companyId_expectedCloseAt_idx" ON "Deal"("companyId", "expectedCloseAt");

-- CreateIndex
CREATE INDEX "DealActivity_companyId_dealId_createdAt_idx" ON "DealActivity"("companyId", "dealId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Task_constructionKey_key" ON "Task"("constructionKey");

-- CreateIndex
CREATE INDEX "Task_companyId_ownerId_status_idx" ON "Task"("companyId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "Task_companyId_dueAt_idx" ON "Task"("companyId", "dueAt");

-- CreateIndex
CREATE INDEX "Task_companyId_dealId_idx" ON "Task"("companyId", "dealId");

-- CreateIndex
CREATE INDEX "Lead_companyId_status_idx" ON "Lead"("companyId", "status");

-- CreateIndex
CREATE INDEX "Lead_companyId_source_idx" ON "Lead"("companyId", "source");

-- CreateIndex
CREATE INDEX "Lead_companyId_phone_idx" ON "Lead"("companyId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_id_companyId_key" ON "Lead"("id", "companyId");

-- CreateIndex
CREATE INDEX "Product_companyId_name_idx" ON "Product"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_acceptanceId_key" ON "Invoice"("acceptanceId");

-- CreateIndex
CREATE INDEX "Invoice_companyId_status_idx" ON "Invoice"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_invoiceNumber_key" ON "Invoice"("companyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "FeedPost_companyId_createdAt_idx" ON "FeedPost"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_companyId_channel_createdAt_idx" ON "ChatMessage"("companyId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");

-- CreateIndex
CREATE INDEX "WorkLog_companyId_userId_clockInAt_idx" ON "WorkLog"("companyId", "userId", "clockInAt");

-- CreateIndex
CREATE INDEX "LeaveRequest_companyId_status_idx" ON "LeaveRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "AutomationRule_companyId_triggerStageId_idx" ON "AutomationRule"("companyId", "triggerStageId");

-- CreateIndex
CREATE INDEX "AuditEvent_companyId_createdAt_idx" ON "AuditEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_companyId_entityType_entityId_idx" ON "AuditEvent"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_companyId_key" ON "Subscription"("companyId");

-- CreateIndex
CREATE INDEX "BillingEvent_subscriptionId_idx" ON "BillingEvent"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_provider_externalEventId_key" ON "BillingEvent"("provider", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionProject_dealId_key" ON "ConstructionProject"("dealId");

-- CreateIndex
CREATE INDEX "ConstructionProject_companyId_status_idx" ON "ConstructionProject"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionProject_id_companyId_key" ON "ConstructionProject"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionProject_companyId_number_key" ON "ConstructionProject"("companyId", "number");

-- CreateIndex
CREATE INDEX "ConstructionEstimate_companyId_projectId_idx" ON "ConstructionEstimate"("companyId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionEstimate_companyId_operationKey_key" ON "ConstructionEstimate"("companyId", "operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionEstimate_projectId_version_key" ON "ConstructionEstimate"("projectId", "version");

-- CreateIndex
CREATE INDEX "EstimateLine_companyId_estimateId_idx" ON "EstimateLine"("companyId", "estimateId");

-- CreateIndex
CREATE INDEX "ProjectCost_companyId_projectId_idx" ON "ProjectCost"("companyId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCost_companyId_operationKey_key" ON "ProjectCost"("companyId", "operationKey");

-- CreateIndex
CREATE INDEX "ProjectChange_companyId_projectId_idx" ON "ProjectChange"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "SiteReport_companyId_projectId_idx" ON "SiteReport"("companyId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteReport_companyId_operationKey_key" ON "SiteReport"("companyId", "operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDocument_storageKey_key" ON "ProjectDocument"("storageKey");

-- CreateIndex
CREATE INDEX "ProjectDocument_companyId_projectId_idx" ON "ProjectDocument"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "TradePartner_companyId_kind_idx" ON "TradePartner"("companyId", "kind");

-- CreateIndex
CREATE INDEX "MaterialRequest_companyId_projectId_idx" ON "MaterialRequest"("companyId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRequest_companyId_operationKey_key" ON "MaterialRequest"("companyId", "operationKey");

-- CreateIndex
CREATE INDEX "SupplyQuote_companyId_projectId_idx" ON "SupplyQuote"("companyId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_requestId_key" ON "PurchaseOrder"("requestId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_projectId_idx" ON "PurchaseOrder"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "StockMovement_companyId_projectId_productId_idx" ON "StockMovement"("companyId", "projectId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_companyId_operationKey_key" ON "StockMovement"("companyId", "operationKey");

-- CreateIndex
CREATE INDEX "Subcontract_companyId_projectId_idx" ON "Subcontract"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "SubcontractProgress_companyId_projectId_idx" ON "SubcontractProgress"("companyId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubcontractProgress_companyId_operationKey_key" ON "SubcontractProgress"("companyId", "operationKey");

-- CreateIndex
CREATE INDEX "WorkAcceptance_companyId_projectId_idx" ON "WorkAcceptance"("companyId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkAcceptance_companyId_operationKey_key" ON "WorkAcceptance"("companyId", "operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkAcceptance_companyId_projectId_number_key" ON "WorkAcceptance"("companyId", "projectId", "number");

-- CreateIndex
CREATE INDEX "AcceptanceLine_companyId_projectId_idx" ON "AcceptanceLine"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectPayment_companyId_projectId_idx" ON "ProjectPayment"("companyId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPayment_companyId_operationKey_key" ON "ProjectPayment"("companyId", "operationKey");

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
CREATE UNIQUE INDEX "InboxChannel_companyId_type_externalAccountId_key" ON "InboxChannel"("companyId", "type", "externalAccountId");

-- CreateIndex
CREATE INDEX "InboxConversation_companyId_assignedUserId_status_lastMessa_idx" ON "InboxConversation"("companyId", "assignedUserId", "status", "lastMessageAt");

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

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerifyToken" ADD CONSTRAINT "EmailVerifyToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealActivity" ADD CONSTRAINT "DealActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealActivity" ADD CONSTRAINT "DealActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_companyId_fkey" FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "WorkAcceptance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionProject" ADD CONSTRAINT "ConstructionProject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionProject" ADD CONSTRAINT "ConstructionProject_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionProject" ADD CONSTRAINT "ConstructionProject_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionEstimate" ADD CONSTRAINT "ConstructionEstimate_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLine" ADD CONSTRAINT "EstimateLine_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "ConstructionEstimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChange" ADD CONSTRAINT "ProjectChange_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteReport" ADD CONSTRAINT "SiteReport_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteReport" ADD CONSTRAINT "SiteReport_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SiteReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyQuote" ADD CONSTRAINT "SupplyQuote_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyQuote" ADD CONSTRAINT "SupplyQuote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyQuote" ADD CONSTRAINT "SupplyQuote_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "TradePartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "TradePartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcontract" ADD CONSTRAINT "Subcontract_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcontract" ADD CONSTRAINT "Subcontract_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "TradePartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractProgress" ADD CONSTRAINT "SubcontractProgress_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractProgress" ADD CONSTRAINT "SubcontractProgress_subcontractId_fkey" FOREIGN KEY ("subcontractId") REFERENCES "Subcontract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAcceptance" ADD CONSTRAINT "WorkAcceptance_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptanceLine" ADD CONSTRAINT "AcceptanceLine_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptanceLine" ADD CONSTRAINT "AcceptanceLine_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "WorkAcceptance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPayment" ADD CONSTRAINT "ProjectPayment_subcontractId_fkey" FOREIGN KEY ("subcontractId") REFERENCES "Subcontract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPayment" ADD CONSTRAINT "ProjectPayment_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxChannel" ADD CONSTRAINT "InboxChannel_integrationId_companyId_fkey" FOREIGN KEY ("integrationId", "companyId") REFERENCES "InboxIntegration"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversation" ADD CONSTRAINT "InboxConversation_channelId_companyId_fkey" FOREIGN KEY ("channelId", "companyId") REFERENCES "InboxChannel"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversation" ADD CONSTRAINT "InboxConversation_contactId_companyId_fkey" FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversation" ADD CONSTRAINT "InboxConversation_leadId_companyId_fkey" FOREIGN KEY ("leadId", "companyId") REFERENCES "Lead"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_conversationId_companyId_fkey" FOREIGN KEY ("conversationId", "companyId") REFERENCES "InboxConversation"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_channelId_companyId_fkey" FOREIGN KEY ("channelId", "companyId") REFERENCES "InboxChannel"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_contactId_companyId_fkey" FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxInternalNote" ADD CONSTRAINT "InboxInternalNote_conversationId_companyId_fkey" FOREIGN KEY ("conversationId", "companyId") REFERENCES "InboxConversation"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxAttachment" ADD CONSTRAINT "InboxAttachment_messageId_companyId_fkey" FOREIGN KEY ("messageId", "companyId") REFERENCES "InboxMessage"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxWebhookEvent" ADD CONSTRAINT "InboxWebhookEvent_integrationId_companyId_fkey" FOREIGN KEY ("integrationId", "companyId") REFERENCES "InboxIntegration"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxReadCursor" ADD CONSTRAINT "InboxReadCursor_conversationId_companyId_fkey" FOREIGN KEY ("conversationId", "companyId") REFERENCES "InboxConversation"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

