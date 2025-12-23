-- CreateEnum
CREATE TYPE "ServiceDescriptionStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('HOURLY', 'FIXED');

-- CreateTable
CREATE TABLE "service_descriptions" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "ServiceDescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_description_topics" (
    "id" TEXT NOT NULL,
    "serviceDescriptionId" TEXT NOT NULL,
    "topicName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "pricingMode" "PricingMode" NOT NULL DEFAULT 'HOURLY',
    "hourlyRate" DECIMAL(10,2),
    "fixedFee" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_description_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_description_line_items" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "timeEntryId" TEXT,
    "date" DATE,
    "description" TEXT NOT NULL,
    "hours" DECIMAL(4,2),
    "fixedAmount" DECIMAL(10,2),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_description_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_descriptions_clientId_idx" ON "service_descriptions"("clientId");

-- CreateIndex
CREATE INDEX "service_descriptions_status_idx" ON "service_descriptions"("status");

-- CreateIndex
CREATE INDEX "service_description_topics_serviceDescriptionId_idx" ON "service_description_topics"("serviceDescriptionId");

-- CreateIndex
CREATE INDEX "service_description_line_items_topicId_idx" ON "service_description_line_items"("topicId");

-- CreateIndex
CREATE INDEX "service_description_line_items_timeEntryId_idx" ON "service_description_line_items"("timeEntryId");

-- AddForeignKey
ALTER TABLE "service_descriptions" ADD CONSTRAINT "service_descriptions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_descriptions" ADD CONSTRAINT "service_descriptions_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_description_topics" ADD CONSTRAINT "service_description_topics_serviceDescriptionId_fkey" FOREIGN KEY ("serviceDescriptionId") REFERENCES "service_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_description_line_items" ADD CONSTRAINT "service_description_line_items_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "service_description_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_description_line_items" ADD CONSTRAINT "service_description_line_items_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "time_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
