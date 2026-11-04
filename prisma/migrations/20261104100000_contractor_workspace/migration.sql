-- CreateTable
CREATE TABLE "ConstructionProject" (
    "stage" TEXT NOT NULL DEFAULT 'ESTIMATE',
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "contractNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConstructionProject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConstructionProject_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConstructionProject_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionEstimate" (
    "operationKey" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "markupBps" INTEGER NOT NULL DEFAULT 0,
    "vatBps" INTEGER NOT NULL DEFAULT 0,
    "extraMinor" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConstructionEstimate_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EstimateLine" (
    "subcontractUnitMinor" INTEGER NOT NULL DEFAULT 0,
    "equipmentUnitMinor" INTEGER NOT NULL DEFAULT 0,
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "materialUnitMinor" INTEGER NOT NULL,
    "laborUnitMinor" INTEGER NOT NULL,
    "otherUnitMinor" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EstimateLine_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "ConstructionEstimate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectCost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "operationKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectCost_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "plannedCostMinor" INTEGER NOT NULL,
    "netRevenueMinor" INTEGER NOT NULL,
    "vatBps" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectChange_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "authorId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PROGRESS',
    "body" TEXT NOT NULL,
    "completedQuantity" TEXT NOT NULL DEFAULT '0',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "operationKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteReport_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SiteReport_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectDocument_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectDocument_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SiteReport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradePartner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "specialty" TEXT,
    "phone" TEXT,
    "email" TEXT
);

-- CreateTable
CREATE TABLE "MaterialRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialRequest_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplyQuote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "unitMinor" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplyQuote_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupplyQuote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupplyQuote_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "TradePartner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "unitMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseOrder_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "TradePartner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "valueMinor" INTEGER NOT NULL DEFAULT 0,
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "kind" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "otherProjectId" TEXT,
    "operationKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subcontract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "unitMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subcontract_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subcontract_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "TradePartner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubcontractProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subcontractId" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    CONSTRAINT "SubcontractProgress_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubcontractProgress_subcontractId_fkey" FOREIGN KEY ("subcontractId") REFERENCES "Subcontract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkAcceptance" (
    "operationKey" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "vatBps" INTEGER NOT NULL DEFAULT 0,
    "netMinor" INTEGER NOT NULL,
    "vatMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "confirmedAt" DATETIME,
    "confirmedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkAcceptance_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcceptanceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "acceptanceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "unitMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    CONSTRAINT "AcceptanceLine_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AcceptanceLine_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "WorkAcceptance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectPayment" (
    "subcontractId" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "operationKey" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectPayment_subcontractId_fkey" FOREIGN KEY ("subcontractId") REFERENCES "Subcontract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectPayment_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "phase" TEXT,
    "constructionKey" TEXT,
    "projectId" TEXT,
    "plannedQuantity" TEXT,
    "workUnit" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "boardStage" TEXT NOT NULL DEFAULT 'TODO',
    "checklistJson" TEXT,
    "dueAt" DATETIME,
    "completedAt" DATETIME,
    "ownerId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "customerId" TEXT,
    "dealId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("boardStage", "checklistJson", "companyId", "completedAt", "createdAt", "creatorId", "customerId", "dealId", "description", "dueAt", "id", "ownerId", "priority", "status", "title", "updatedAt") SELECT "boardStage", "checklistJson", "companyId", "completedAt", "createdAt", "creatorId", "customerId", "dealId", "description", "dueAt", "id", "ownerId", "priority", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_constructionKey_key" ON "Task"("constructionKey");
CREATE INDEX "Task_companyId_ownerId_status_idx" ON "Task"("companyId", "ownerId", "status");
CREATE INDEX "Task_companyId_dueAt_idx" ON "Task"("companyId", "dueAt");
CREATE INDEX "Task_companyId_dealId_idx" ON "Task"("companyId", "dealId");
CREATE TABLE "new_Invoice" (
    "vatRateBps" INTEGER,
    "projectId" TEXT,
    "acceptanceId" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dealId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "vatRate" INTEGER NOT NULL DEFAULT 18,
    "vatMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "includeVat" BOOLEAN NOT NULL DEFAULT true,
    "bankPreference" TEXT NOT NULL DEFAULT 'BOG_TBC',
    "rsGeWaybillRef" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "ConstructionProject" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "WorkAcceptance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("bankPreference", "companyId", "createdAt", "currency", "customerId", "dealId", "dueDate", "id", "includeVat", "invoiceNumber", "issueDate", "notes", "rsGeWaybillRef", "status", "subtotalMinor", "totalMinor", "updatedAt", "vatMinor", "vatRate") SELECT "bankPreference", "companyId", "createdAt", "currency", "customerId", "dealId", "dueDate", "id", "includeVat", "invoiceNumber", "issueDate", "notes", "rsGeWaybillRef", "status", "subtotalMinor", "totalMinor", "updatedAt", "vatMinor", "vatRate" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_acceptanceId_key" ON "Invoice"("acceptanceId");
CREATE INDEX "Invoice_companyId_status_idx" ON "Invoice"("companyId", "status");
CREATE UNIQUE INDEX "Invoice_companyId_invoiceNumber_key" ON "Invoice"("companyId", "invoiceNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

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

-- Preserve retired automation history and disable unavailable actions.
UPDATE "AutomationRule" SET "isActive" = false WHERE "actionType" <> 'CREATE_TASK';
