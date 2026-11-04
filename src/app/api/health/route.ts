import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [{ prisma }, { ensureDbInitialized }] = await Promise.all([import("@/lib/db"), import("@/lib/db-init")]);
    await ensureDbInitialized();
    // A database connection alone can be healthy while the deployed schema is stale.
    await Promise.all([
      prisma.constructionProject.count(),
      prisma.inboxConversation.count(),
      prisma.task.findFirst({ select: { projectId: true, phase: true } }),
      prisma.invoice.findFirst({ select: { projectId: true, acceptanceId: true, vatRateBps: true } }),
    ]);
    return NextResponse.json({
      status: "ok",
      service: "crm-solution",
      time: new Date().toISOString(),
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const reason = code === "DEPLOYMENT_DB_MISSING" ? "deployment_artifact_missing" : code === "P2021" || code === "P2022" ? "schema_not_ready" : "database_unavailable";
    return NextResponse.json(
      {
        status: "degraded",
        db: false,
        reason,
      },
      { status: 503 },
    );
  }
}
