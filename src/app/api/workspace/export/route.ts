import { NextRequest, NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth/workspace";
import { exportWorkspace } from "@/lib/services/export";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCapability("company.export");
    const format = request.nextUrl.searchParams.get("format") || "json";
    if (format !== "json" && format !== "csv") return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    const stream = await exportWorkspace(ctx, format);
    return new Response(stream, { headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="crm-export-v1.${format}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    const status = isAppError(error) ? error.status : (error as { status?: number })?.status;
    return NextResponse.json({ error: "Export unavailable" }, { status: status === 401 || status === 403 ? status : 500 });
  }
}
