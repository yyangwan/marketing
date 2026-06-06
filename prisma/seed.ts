import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const url = process.env.DATABASE_URL!.replace(/^mysql:/, "mariadb:");
const adapter = new PrismaMariaDb(url);
const prisma = new PrismaClient({ adapter });

const workspaceId = process.env.SEED_GENILINK_WORKSPACE_ID || "demo-workspace";
const projectId = process.env.SEED_GENILINK_PROJECT_ID || "demo-project";
const brandId = process.env.SEED_GENILINK_BRAND_ID || "demo-brand";
const userId = process.env.SEED_GENILINK_USER_ID || "demo-user";

async function main() {
  const existingContent = await prisma.contentPiece.count({
    where: { workspaceId, projectId },
  });
  if (existingContent > 0) {
    console.log("Seed data already exists, skipping content creation.");
    return;
  }

  const brandVoice = await prisma.brandVoice.create({
    data: {
      workspaceId,
      brandId,
      createdByUserId: userId,
      name: "Demo Brand Voice",
      description: "Professional, clear, and useful.",
      guidelines: "Use concrete examples and avoid unsupported claims.",
      samples: JSON.stringify(["A concise demo content sample."]),
    },
  });

  const draft = await prisma.contentPiece.create({
    data: {
      workspaceId,
      projectId,
      brandId,
      createdByUserId: userId,
      brandVoiceId: brandVoice.id,
      title: "Demo content strategy brief",
      type: "blog_post",
      brief: JSON.stringify({
        topic: "Demo content strategy brief",
        keyPoints: ["centralized project identity", "brand voice profile", "content workflow"],
        platforms: ["wechat", "weibo"],
        notes: "",
        references: "",
      }),
      status: "draft",
      platformContents: {
        create: [
          {
            platform: "wechat",
            status: "draft",
            content: "<h2>Demo</h2><p>This content belongs to a GeniLink project ID.</p>",
          },
          {
            platform: "weibo",
            status: "draft",
            content: "Demo content powered by centralized GeniLink IDs.",
          },
        ],
      },
    },
  });

  console.log("Seed data created:");
  console.log(`  Workspace ID: ${workspaceId}`);
  console.log(`  Project ID: ${projectId}`);
  console.log(`  Brand ID: ${brandId}`);
  console.log(`  User ID: ${userId}`);
  console.log(`  ContentPiece: ${draft.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
