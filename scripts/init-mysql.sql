-- ContentOS MySQL 初始化脚本
-- 使用方法: mysql -u root -p < init-mysql.sql
-- 或在 MySQL 客户端中 source /path/to/init-mysql.sql

CREATE DATABASE IF NOT EXISTS `contentos` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `contentos`;

-- ============================================
-- 基础表: User, Workspace
-- ============================================

CREATE TABLE `User` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `onboardingCompleted` BOOLEAN NOT NULL DEFAULT false,
  `onboardingStep` VARCHAR(191) NOT NULL DEFAULT 'welcome',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `User_email_key`(`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Workspace` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- 关联表: WorkspaceMember, WorkspaceInvite
-- ============================================

CREATE TABLE `WorkspaceMember` (
  `id` VARCHAR(36) NOT NULL,
  `workspaceId` VARCHAR(36) NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `role` VARCHAR(191) NOT NULL DEFAULT 'member',
  `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `WorkspaceMember_workspaceId_userId_key`(`workspaceId`, `userId`),
  INDEX `WorkspaceMember_workspaceId_idx`(`workspaceId`),
  INDEX `WorkspaceMember_userId_idx`(`userId`),
  CONSTRAINT `WorkspaceMember_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE,
  CONSTRAINT `WorkspaceMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkspaceInvite` (
  `id` VARCHAR(36) NOT NULL,
  `workspaceId` VARCHAR(36) NOT NULL,
  `token` VARCHAR(36) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL DEFAULT 'member',
  `invitedBy` VARCHAR(191) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `WorkspaceInvite_token_key`(`token`),
  INDEX `WorkspaceInvite_workspaceId_idx`(`workspaceId`),
  CONSTRAINT `WorkspaceInvite_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- BrandVoice (Project 和 ContentPiece 依赖此表)
-- ============================================

CREATE TABLE `BrandVoice` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(36) NOT NULL,
  `description` VARCHAR(191) NULL DEFAULT '',
  `guidelines` VARCHAR(191) NULL DEFAULT '',
  `samples` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `BrandVoice_workspaceId_idx`(`workspaceId`),
  CONSTRAINT `BrandVoice_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- Project
-- ============================================

CREATE TABLE `Project` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `clientName` VARCHAR(191) NOT NULL DEFAULT '',
  `workspaceId` VARCHAR(36) NOT NULL,
  `brandVoiceId` VARCHAR(36) NULL,
  `defaultAssigneeId` VARCHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Project_workspaceId_name_key`(`workspaceId`, `name`),
  INDEX `Project_workspaceId_idx`(`workspaceId`),
  INDEX `Project_brandVoiceId_idx`(`brandVoiceId`),
  CONSTRAINT `Project_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE,
  CONSTRAINT `Project_brandVoiceId_fkey` FOREIGN KEY (`brandVoiceId`) REFERENCES `BrandVoice`(`id`) ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- ContentPiece
-- ============================================

CREATE TABLE `ContentPiece` (
  `id` VARCHAR(36) NOT NULL,
  `projectId` VARCHAR(36) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'blog_post',
  `brief` TEXT NOT NULL,
  `brandVoiceId` VARCHAR(36) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `reviewToken` VARCHAR(36) NULL,
  `reviewExpiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ContentPiece_reviewToken_key`(`reviewToken`),
  INDEX `ContentPiece_projectId_idx`(`projectId`),
  INDEX `ContentPiece_brandVoiceId_idx`(`brandVoiceId`),
  CONSTRAINT `ContentPiece_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE,
  CONSTRAINT `ContentPiece_brandVoiceId_fkey` FOREIGN KEY (`brandVoiceId`) REFERENCES `BrandVoice`(`id`) ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- PlatformContent
-- ============================================

CREATE TABLE `PlatformContent` (
  `id` VARCHAR(36) NOT NULL,
  `contentPieceId` VARCHAR(36) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `content` TEXT NULL,
  `publishedUrl` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PlatformContent_contentPieceId_platform_key`(`contentPieceId`, `platform`),
  INDEX `PlatformContent_contentPieceId_idx`(`contentPieceId`),
  CONSTRAINT `PlatformContent_contentPieceId_fkey` FOREIGN KEY (`contentPieceId`) REFERENCES `ContentPiece`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- ReviewComment
-- ============================================

CREATE TABLE `ReviewComment` (
  `id` VARCHAR(36) NOT NULL,
  `contentPieceId` VARCHAR(36) NOT NULL,
  `authorName` VARCHAR(191) NOT NULL,
  `comment` TEXT NULL,
  `action` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ReviewComment_contentPieceId_idx`(`contentPieceId`),
  CONSTRAINT `ReviewComment_contentPieceId_fkey` FOREIGN KEY (`contentPieceId`) REFERENCES `ContentPiece`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- AITemplate
-- ============================================

CREATE TABLE `AITemplate` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(36) NOT NULL,
  `description` VARCHAR(191) NULL DEFAULT '',
  `template` TEXT NOT NULL,
  `variables` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `AITemplate_workspaceId_idx`(`workspaceId`),
  CONSTRAINT `AITemplate_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- ContentQuality
-- ============================================

CREATE TABLE `ContentQuality` (
  `id` VARCHAR(36) NOT NULL,
  `contentPieceId` VARCHAR(36) NOT NULL,
  `quality` INT NOT NULL DEFAULT 0,
  `engagement` INT NOT NULL DEFAULT 0,
  `brandVoice` INT NOT NULL DEFAULT 0,
  `platformFit` INT NOT NULL DEFAULT 0,
  `sentiment` INT NOT NULL DEFAULT 0,
  `topicConsistency` INT NOT NULL DEFAULT 0,
  `originality` INT NOT NULL DEFAULT 0,
  `localMetrics` TEXT NULL,
  `suggestions` TEXT NULL,
  `previousScores` TEXT NULL,
  `evaluationCount` INT NOT NULL DEFAULT 1,
  `evaluatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ContentQuality_contentPieceId_key`(`contentPieceId`),
  INDEX `ContentQuality_evaluatedAt_idx`(`evaluatedAt`),
  CONSTRAINT `ContentQuality_contentPieceId_fkey` FOREIGN KEY (`contentPieceId`) REFERENCES `ContentPiece`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- QualityHistory
-- ============================================

CREATE TABLE `QualityHistory` (
  `id` VARCHAR(36) NOT NULL,
  `contentPieceId` VARCHAR(36) NOT NULL,
  `quality` INT NOT NULL,
  `engagement` INT NOT NULL,
  `brandVoice` INT NOT NULL,
  `platformFit` INT NOT NULL,
  `sentiment` INT NOT NULL DEFAULT 0,
  `topicConsistency` INT NOT NULL DEFAULT 0,
  `originality` INT NOT NULL DEFAULT 0,
  `contentHash` VARCHAR(191) NOT NULL,
  `evaluatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `QualityHistory_contentPieceId_evaluatedAt_idx`(`contentPieceId`, `evaluatedAt`),
  CONSTRAINT `QualityHistory_contentPieceId_fkey` FOREIGN KEY (`contentPieceId`) REFERENCES `ContentPiece`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- ContentSchedule
-- ============================================

CREATE TABLE `ContentSchedule` (
  `id` VARCHAR(36) NOT NULL,
  `contentId` VARCHAR(36) NOT NULL,
  `scheduledAt` DATETIME(3) NOT NULL,
  `publishedAt` DATETIME(3) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'scheduled',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ContentSchedule_contentId_key`(`contentId`),
  INDEX `ContentSchedule_scheduledAt_idx`(`scheduledAt`),
  INDEX `ContentSchedule_status_idx`(`status`),
  CONSTRAINT `ContentSchedule_contentId_fkey` FOREIGN KEY (`contentId`) REFERENCES `ContentPiece`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- Notification
-- ============================================

CREATE TABLE `Notification` (
  `id` VARCHAR(36) NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `workspaceId` VARCHAR(36) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `link` VARCHAR(191) NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Notification_userId_isRead_idx`(`userId`, `isRead`),
  INDEX `Notification_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `Notification_workspaceId_idx`(`workspaceId`),
  CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE,
  CONSTRAINT `Notification_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- GenieSource
-- ============================================

CREATE TABLE `GenieSource` (
  `id` VARCHAR(36) NOT NULL,
  `workspaceId` VARCHAR(36) NOT NULL,
  `url` VARCHAR(191) NOT NULL,
  `businessType` VARCHAR(191) NULL,
  `keyProducts` TEXT NULL,
  `brandTone` VARCHAR(191) NULL,
  `targetAudience` VARCHAR(191) NULL,
  `recurringTopics` TEXT NULL,
  `contentThemes` TEXT NULL,
  `suggestedContentTypes` TEXT NULL,
  `lastAnalyzedAt` DATETIME(3) NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `GenieSource_workspaceId_url_key`(`workspaceId`, `url`),
  INDEX `GenieSource_workspaceId_enabled_idx`(`workspaceId`, `enabled`),
  INDEX `GenieSource_lastAnalyzedAt_idx`(`lastAnalyzedAt`),
  CONSTRAINT `GenieSource_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- PlatformApiConfig
-- ============================================

CREATE TABLE `PlatformApiConfig` (
  `id` VARCHAR(36) NOT NULL,
  `workspaceId` VARCHAR(36) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `app_id` VARCHAR(191) NULL,
  `app_secret` VARCHAR(191) NULL,
  `access_token` VARCHAR(191) NULL,
  `refresh_token` VARCHAR(191) NULL,
  `tokenExpiresAt` DATETIME(3) NULL,
  `lastRefreshedAt` DATETIME(3) NULL,
  `extraConfig` TEXT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PlatformApiConfig_workspaceId_platform_key`(`workspaceId`, `platform`),
  INDEX `PlatformApiConfig_workspaceId_enabled_idx`(`workspaceId`, `enabled`),
  CONSTRAINT `PlatformApiConfig_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- PublishHistory
-- ============================================

CREATE TABLE `PublishHistory` (
  `id` VARCHAR(36) NOT NULL,
  `workspaceId` VARCHAR(36) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `platformContentId` VARCHAR(36) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `publishedUrl` VARCHAR(191) NULL,
  `platform_post_id` VARCHAR(191) NULL,
  `error_message` TEXT NULL,
  `attemptCount` INT NOT NULL DEFAULT 0,
  `lastAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PublishHistory_workspaceId_platform_idx`(`workspaceId`, `platform`),
  INDEX `PublishHistory_platformContentId_idx`(`platformContentId`),
  INDEX `PublishHistory_status_idx`(`status`),
  INDEX `PublishHistory_createdAt_idx`(`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
