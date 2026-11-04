-- CreateIndex
CREATE INDEX "Contact_companyId_phone_idx" ON "Contact"("companyId", "phone");

-- CreateIndex
CREATE INDEX "Lead_companyId_phone_idx" ON "Lead"("companyId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "InboxChannel_companyId_type_externalAccountId_key" ON "InboxChannel"("companyId", "type", "externalAccountId");
