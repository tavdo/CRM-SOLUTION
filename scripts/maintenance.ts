import { prisma } from "../src/lib/db";
async function main() { try {
  const before = new Date();
  const limits = await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: before } } });
  const sessions = await prisma.session.deleteMany({ where: { expiresAt: { lt: before } } });
  console.log(JSON.stringify({ expiredRateLimitsRemoved: limits.count, expiredSessionsRemoved: sessions.count }));
} finally { await prisma.$disconnect(); } }
void main().catch(() => { console.error("Maintenance failed"); process.exitCode = 1; });
