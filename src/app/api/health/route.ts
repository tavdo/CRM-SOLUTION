import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      service: "crm-solution",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ status: "degraded", db: false }, { status: 503 });
  }
}
