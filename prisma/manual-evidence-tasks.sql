-- Reviewed additive DDL for manual tasks. Not executed; full fresh installs use the complete Prisma schema.
CREATE TABLE `ManualEvidenceTask` (
    `id` VARCHAR(32) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `approvalId` VARCHAR(32) NOT NULL,
    `briefSnapshot` MEDIUMTEXT NOT NULL,
    `snapshotHash` VARCHAR(64) NOT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `ownerUserId` VARCHAR(191) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `version` INTEGER NOT NULL DEFAULT 1,
    `deliveryUrl` TEXT NULL,
    `completionNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ManualEvidenceTask_workspaceId_projectId_createdAt_idx`(`workspaceId`, `projectId`, `createdAt`),
    UNIQUE INDEX `ManualEvidenceTask_workspaceId_projectId_approvalId_key`(`workspaceId`, `projectId`, `approvalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ManualEvidenceTaskEvent` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(32) NOT NULL,
    `version` INTEGER NOT NULL,
    `action` VARCHAR(32) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `deliveryUrl` TEXT NULL,
    `idempotencyKey` VARCHAR(100) NOT NULL,
    `requestHash` VARCHAR(64) NOT NULL,
    `responseSnapshot` MEDIUMTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ManualEvidenceTaskEvent_taskId_version_key`(`taskId`, `version`),
    UNIQUE INDEX `ManualEvidenceTaskEvent_taskId_idempotencyKey_key`(`taskId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ManualEvidenceTaskEvent` ADD CONSTRAINT `ManualEvidenceTaskEvent_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `ManualEvidenceTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
