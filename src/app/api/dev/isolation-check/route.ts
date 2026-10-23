import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { requireWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { getCustomer } from "@/lib/services/customers";
import { getDeal } from "@/lib/services/deals";
import { isAppError } from "@/lib/errors";

/**
 * Development helper: attempt to read another company's record IDs.
 * Returns whether isolation blocked access. Disabled when NODE_ENV=production.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    customerId?: string;
    dealId?: string;
  };

  const ctx = await requireWorkspace();
  const results: Record<string, string> = {};

  if (body.customerId) {
    try {
      await getCustomer(ctx, body.customerId);
      results.customer = "LEAK";
    } catch (err) {
      results.customer = isAppError(err) ? String(err.status) : "error";
    }
  }

  if (body.dealId) {
    try {
      await getDeal(ctx, body.dealId);
      results.deal = "LEAK";
    } catch (err) {
      results.deal = isAppError(err) ? String(err.status) : "error";
    }
  }

  // Direct enumeration should still be scoped
  const foreignCustomers = await prisma.customer.count({
    where: { companyId: { not: ctx.company.id } },
  });

  return NextResponse.json({
    workspace: ctx.company.id,
    foreignCustomersExist: foreignCustomers > 0,
    attempts: results,
    note: "404/403 means isolation held; LEAK means a bug",
  });
}
