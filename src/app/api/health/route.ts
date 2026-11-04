import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/db-init";

export async function GET() {
  try {
    await ensureDbInitialized();
    // A database connection alone can be healthy while the deployed schema is stale.
    await Promise.all([
      prisma.constructionProject.count(),
      prisma.task.findFirst({ select: { projectId: true, phase: true } }),
      prisma.invoice.findFirst({ select: { projectId: true, acceptanceId: true, vatRateBps: true } }),
    ]);
    return NextResponse.json({
      status: "ok",
      service: "crm-solution",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        db: false,
      },
      { status: 503 },
    );
  }
}
