import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const url = process.env.DATABASE_URL!.replace(/^mysql:/, 'mariadb:');
const adapter = new PrismaMariaDb(url);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Check all schedules
  const schedules = await prisma.contentSchedule.findMany({
    include: { contentPiece: true },
    orderBy: { scheduledAt: 'desc' },
  });

  console.log('=== All Content Schedules ===');
  console.log('Total:', schedules.length);
  for (const s of schedules) {
    console.log(`- ${s.scheduledAt.toISOString()} | Status: ${s.status} | Title: ${s.contentPiece?.title || 'N/A'}`);
  }

  // Check all content pieces
  const pieces = await prisma.contentPiece.findMany({
    select: { id: true, title: true, status: true, createdAt: true },
  });

  console.log('\n=== All Content Pieces ===');
  console.log('Total:', pieces.length);
  for (const p of pieces) {
    console.log(`- ${p.id} | ${p.title} | Status: ${p.status}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
