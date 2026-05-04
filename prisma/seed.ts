import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("demo123", 12);

  const user = await prisma.user.create({
    data: { email: "demo@contentos.dev", passwordHash, name: "Demo User" },
  });

  const workspace = await prisma.workspace.create({
    data: { name: "Demo Agency" },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Demo Client",
      clientName: "示例客户",
      workspaceId: workspace.id,
    },
  });

  // Create a sample content piece in "draft" state
  const draft = await prisma.contentPiece.create({
    data: {
      projectId: project.id,
      title: "2024年企业数字化转型趋势分析",
      type: "blog_post",
      brief: JSON.stringify({
        topic: "2024年企业数字化转型趋势分析",
        keyPoints: ["数字化转型的重要性", "关键技术趋势", "企业实施建议"],
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
            content: "<h2>引言</h2><p>在当今数字化快速发展的时代，企业面临的竞争日益激烈。如何在这个充满挑战的环境中脱颖而出，成为每个企业管理者需要思考的核心问题。</p><h2>核心观点</h2><p>首先，我们需要认识到创新不仅仅是技术层面的突破，更是思维方式的革新。企业需要建立鼓励创新的内部机制，让每一位员工都能成为创新的参与者。</p><h2>实践建议</h2><ul><li>建立跨部门协作机制，打破信息孤岛</li><li>定期开展客户满意度调研，及时调整策略</li><li>投资员工培训，提升团队整体能力</li></ul>",
          },
          {
            platform: "weibo",
            status: "draft",
            content: "创新不是口号，是行动 💡 从今天开始，用客户思维重塑你的业务流程，让每一次互动都有温度。#企业管理 #创新驱动 #客户体验",
          },
        ],
      },
    },
  });

  // Create a sample in "editing" state
  await prisma.contentPiece.create({
    data: {
      projectId: project.id,
      title: "AI 如何改变内容营销的未来",
      type: "blog_post",
      brief: JSON.stringify({
        topic: "AI 如何改变内容营销的未来",
        keyPoints: ["AI 内容生成的现状", "对营销人员的影响", "未来展望"],
        platforms: ["wechat"],
        notes: "语气要专业但不过于技术化",
        references: "",
      }),
      status: "editing",
      platformContents: {
        create: [
          {
            platform: "wechat",
            status: "editing",
            content: "<h2>AI 内容营销的现状</h2><p>人工智能正在以前所未有的速度改变内容营销的格局。从自动化内容生成到精准的受众分析，AI 技术正在成为营销人员不可或缺的工具。</p>",
          },
        ],
      },
    },
  });

  // Create a sample in "approved" state
  await prisma.contentPiece.create({
    data: {
      projectId: project.id,
      title: "小红书种草文案：夏日护肤必备清单",
      type: "social_post",
      brief: JSON.stringify({
        topic: "小红书种草文案：夏日护肤必备清单",
        keyPoints: ["防晒", "补水", "清爽质地"],
        platforms: ["wechat", "weibo", "xiaohongshu"],
        notes: "语气轻松活泼",
        references: "",
      }),
      status: "approved",
      platformContents: {
        create: [
          { platform: "wechat", status: "approved", content: "<p>夏天来了，你的护肤准备好了吗？</p>" },
          { platform: "weibo", status: "approved", content: "夏天护肤三件套：防晒、补水、清爽 💪 #护肤 #夏日" },
          { platform: "xiaohongshu", status: "approved", content: "夏日护肤必备清单来啦！" },
        ],
      },
    },
  });

  console.log("Seed data created:");
  console.log(`  User: ${user.email} (password: demo123)`);
  console.log(`  Workspace: ${workspace.name}`);
  console.log(`  Project: ${project.name}`);
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
