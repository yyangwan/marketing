-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ContentPiece" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'blog_post',
    "brief" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewToken" TEXT,
    "reviewExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlatformContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentPieceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" TEXT,
    "publishedUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformContent_contentPieceId_fkey" FOREIGN KEY ("contentPieceId") REFERENCES "ContentPiece" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentPieceId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "comment" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewComment_contentPieceId_fkey" FOREIGN KEY ("contentPieceId") REFERENCES "ContentPiece" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPiece_reviewToken_key" ON "ContentPiece"("reviewToken");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformContent_contentPieceId_platform_key" ON "PlatformContent"("contentPieceId", "platform");
