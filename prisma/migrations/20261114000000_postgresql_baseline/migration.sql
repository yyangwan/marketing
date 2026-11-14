-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "ContentPiece" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'blog_post',
    "brief" TEXT NOT NULL,
    "brandVoiceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewToken" TEXT,
    "reviewExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformContent" (
    "id" TEXT NOT NULL,
    "contentPieceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" TEXT,
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL,
    "contentPieceId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "comment" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandVoice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "guidelines" TEXT,
    "samples" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandVoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AITemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "description" TEXT,
    "template" TEXT NOT NULL,
    "variables" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AITemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentQuality" (
    "id" TEXT NOT NULL,
    "contentPieceId" TEXT NOT NULL,
    "quality" INTEGER NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "brandVoice" INTEGER NOT NULL DEFAULT 0,
    "platformFit" INTEGER NOT NULL DEFAULT 0,
    "sentiment" INTEGER NOT NULL DEFAULT 0,
    "topicConsistency" INTEGER NOT NULL DEFAULT 0,
    "originality" INTEGER NOT NULL DEFAULT 0,
    "localMetrics" TEXT,
    "suggestions" TEXT,
    "previousScores" TEXT,
    "evaluationCount" INTEGER NOT NULL DEFAULT 1,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentQuality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityHistory" (
    "id" TEXT NOT NULL,
    "contentPieceId" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "engagement" INTEGER NOT NULL,
    "brandVoice" INTEGER NOT NULL,
    "platformFit" INTEGER NOT NULL,
    "sentiment" INTEGER NOT NULL DEFAULT 0,
    "topicConsistency" INTEGER NOT NULL DEFAULT 0,
    "originality" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSchedule" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenieSource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "businessType" TEXT,
    "keyProducts" TEXT,
    "brandTone" TEXT,
    "targetAudience" TEXT,
    "recurringTopics" TEXT,
    "contentThemes" TEXT,
    "suggestedContentTypes" TEXT,
    "lastAnalyzedAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenieSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformApiConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL,
    "app_id" TEXT,
    "app_secret" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "extraConfig" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformApiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishHistory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformContentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "publishedUrl" TEXT,
    "platform_post_id" TEXT,
    "error_message" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBrief" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(32) NOT NULL DEFAULT 'baseline_ready',
    "sourceType" VARCHAR(64) NOT NULL DEFAULT 'visibility_suggestion',
    "sourceSuggestionId" VARCHAR(191) NOT NULL,
    "sourceHash" VARCHAR(64) NOT NULL,
    "sourceSnapshot" TEXT NOT NULL,
    "projectSnapshot" TEXT NOT NULL,
    "baselineBrief" TEXT NOT NULL,
    "refinedCandidate" TEXT,
    "effectiveBrief" TEXT NOT NULL,
    "generationMeta" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "idempotencyRequestHash" VARCHAR(64) NOT NULL,
    "refinementStatus" VARCHAR(32) NOT NULL DEFAULT 'queued',
    "refinementAttempts" INTEGER NOT NULL DEFAULT 0,
    "refinementNextAttemptAt" TIMESTAMP(3),
    "refinementLockedBy" VARCHAR(64),
    "refinementLockedUntil" TIMESTAMP(3),
    "refinementLastError" TEXT,
    "refinementBaseRevision" INTEGER,
    "refinementBaseBrief" TEXT,
    "lastPatchKey" VARCHAR(64),
    "lastPatchHash" VARCHAR(64),
    "lastPatchResponse" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentWorkflow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "briefRevision" INTEGER NOT NULL,
    "briefSnapshot" TEXT NOT NULL,
    "templateId" VARCHAR(64),
    "contentPieceId" TEXT,
    "usageOperationId" VARCHAR(191) NOT NULL,
    "usageStatus" VARCHAR(32) NOT NULL DEFAULT 'reserved',
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "idempotencyRequestHash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'queued',
    "failureCode" VARCHAR(64),
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ContentWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentGenerationRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "platform" VARCHAR(32) NOT NULL,
    "platformContentId" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'queued',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lockedBy" VARCHAR(64),
    "lockedUntil" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureCode" VARCHAR(64),
    "failureMessage" TEXT,
    "providerRequestId" VARCHAR(191),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentGenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualEvidenceTask" (
    "id" VARCHAR(32) NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "approvalId" VARCHAR(32) NOT NULL,
    "briefSnapshot" TEXT NOT NULL,
    "snapshotHash" VARCHAR(64) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "version" INTEGER NOT NULL DEFAULT 1,
    "deliveryUrl" TEXT,
    "completionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualEvidenceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualEvidenceTaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "deliveryUrl" TEXT,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "responseSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualEvidenceTaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentPiece_reviewToken_key" ON "ContentPiece"("reviewToken");

-- CreateIndex
CREATE INDEX "ContentPiece_workspaceId_idx" ON "ContentPiece"("workspaceId");

-- CreateIndex
CREATE INDEX "ContentPiece_projectId_idx" ON "ContentPiece"("projectId");

-- CreateIndex
CREATE INDEX "ContentPiece_brandId_idx" ON "ContentPiece"("brandId");

-- CreateIndex
CREATE INDEX "ContentPiece_createdByUserId_idx" ON "ContentPiece"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformContent_contentPieceId_platform_key" ON "PlatformContent"("contentPieceId", "platform");

-- CreateIndex
CREATE INDEX "BrandVoice_workspaceId_idx" ON "BrandVoice"("workspaceId");

-- CreateIndex
CREATE INDEX "BrandVoice_brandId_idx" ON "BrandVoice"("brandId");

-- CreateIndex
CREATE INDEX "AITemplate_workspaceId_idx" ON "AITemplate"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentQuality_contentPieceId_key" ON "ContentQuality"("contentPieceId");

-- CreateIndex
CREATE INDEX "ContentQuality_evaluatedAt_idx" ON "ContentQuality"("evaluatedAt");

-- CreateIndex
CREATE INDEX "QualityHistory_contentPieceId_evaluatedAt_idx" ON "QualityHistory"("contentPieceId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "ContentSchedule_scheduledAt_idx" ON "ContentSchedule"("scheduledAt");

-- CreateIndex
CREATE INDEX "ContentSchedule_status_idx" ON "ContentSchedule"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentSchedule_contentId_key" ON "ContentSchedule"("contentId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_workspaceId_idx" ON "Notification"("workspaceId");

-- CreateIndex
CREATE INDEX "GenieSource_workspaceId_enabled_idx" ON "GenieSource"("workspaceId", "enabled");

-- CreateIndex
CREATE INDEX "GenieSource_lastAnalyzedAt_idx" ON "GenieSource"("lastAnalyzedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GenieSource_workspaceId_url_key" ON "GenieSource"("workspaceId", "url");

-- CreateIndex
CREATE INDEX "PlatformApiConfig_workspaceId_enabled_idx" ON "PlatformApiConfig"("workspaceId", "enabled");

-- CreateIndex
CREATE INDEX "PlatformApiConfig_projectId_userId_idx" ON "PlatformApiConfig"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformApiConfig_workspaceId_projectId_userId_platform_key" ON "PlatformApiConfig"("workspaceId", "projectId", "userId", "platform");

-- CreateIndex
CREATE INDEX "PublishHistory_workspaceId_platform_idx" ON "PublishHistory"("workspaceId", "platform");

-- CreateIndex
CREATE INDEX "PublishHistory_platformContentId_idx" ON "PublishHistory"("platformContentId");

-- CreateIndex
CREATE INDEX "PublishHistory_status_idx" ON "PublishHistory"("status");

-- CreateIndex
CREATE INDEX "PublishHistory_createdAt_idx" ON "PublishHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ContentBrief_workspaceId_projectId_sourceSuggestionId_idx" ON "ContentBrief"("workspaceId", "projectId", "sourceSuggestionId");

-- CreateIndex
CREATE INDEX "ContentBrief_refinementStatus_refinementNextAttemptAt_refin_idx" ON "ContentBrief"("refinementStatus", "refinementNextAttemptAt", "refinementLockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ContentBrief_workspaceId_projectId_idempotencyKey_key" ON "ContentBrief"("workspaceId", "projectId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ContentWorkflow_contentPieceId_key" ON "ContentWorkflow"("contentPieceId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentWorkflow_usageOperationId_key" ON "ContentWorkflow"("usageOperationId");

-- CreateIndex
CREATE INDEX "ContentWorkflow_workspaceId_projectId_status_idx" ON "ContentWorkflow"("workspaceId", "projectId", "status");

-- CreateIndex
CREATE INDEX "ContentWorkflow_status_idx" ON "ContentWorkflow"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentWorkflow_workspaceId_projectId_idempotencyKey_key" ON "ContentWorkflow"("workspaceId", "projectId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ContentGenerationRun_status_nextAttemptAt_lockedUntil_idx" ON "ContentGenerationRun"("status", "nextAttemptAt", "lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ContentGenerationRun_workflowId_platform_key" ON "ContentGenerationRun"("workflowId", "platform");

-- CreateIndex
CREATE INDEX "ManualEvidenceTask_workspaceId_projectId_createdAt_idx" ON "ManualEvidenceTask"("workspaceId", "projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManualEvidenceTask_workspaceId_projectId_approvalId_key" ON "ManualEvidenceTask"("workspaceId", "projectId", "approvalId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualEvidenceTaskEvent_taskId_version_key" ON "ManualEvidenceTaskEvent"("taskId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ManualEvidenceTaskEvent_taskId_idempotencyKey_key" ON "ManualEvidenceTaskEvent"("taskId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "ContentPiece" ADD CONSTRAINT "ContentPiece_brandVoiceId_fkey" FOREIGN KEY ("brandVoiceId") REFERENCES "BrandVoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformContent" ADD CONSTRAINT "PlatformContent_contentPieceId_fkey" FOREIGN KEY ("contentPieceId") REFERENCES "ContentPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_contentPieceId_fkey" FOREIGN KEY ("contentPieceId") REFERENCES "ContentPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentQuality" ADD CONSTRAINT "ContentQuality_contentPieceId_fkey" FOREIGN KEY ("contentPieceId") REFERENCES "ContentPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityHistory" ADD CONSTRAINT "QualityHistory_contentPieceId_fkey" FOREIGN KEY ("contentPieceId") REFERENCES "ContentPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSchedule" ADD CONSTRAINT "ContentSchedule_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentWorkflow" ADD CONSTRAINT "ContentWorkflow_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ContentBrief"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentGenerationRun" ADD CONSTRAINT "ContentGenerationRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ContentWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualEvidenceTaskEvent" ADD CONSTRAINT "ManualEvidenceTaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ManualEvidenceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
