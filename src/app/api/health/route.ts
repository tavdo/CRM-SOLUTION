import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/db-init";

export async function GET() {
  try {
    await ensureDbInitialized();
    const users = await prisma.user.count();
    const companies = await prisma.company.count();
    return NextResponse.json({
      status: "ok",
      service: "crm-solution",
      users,
      companies,
      time: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        db: false,
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 503 },
    );
  }
}
