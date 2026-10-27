import type { Role } from "@prisma/client";

/**
 * Permission matrix (enforced on the server):
 *
 * | Capability                         | ADMIN | MANAGER | EMPLOYEE |
 * |------------------------------------|-------|---------|----------|
 * | Manage company settings            | ✓     |         |          |
 * | Invite / remove members, set roles | ✓     |         |          |
 * | Manage pipeline & custom fields    | ✓     |         |          |
 * | Manage pipeline automations        | ✓     |         |          |
 * | Manage subscription / billing      | ✓     |         |          |
 * | Create/edit any CRM records        | ✓     | ✓       |          |
 * | Assign owners / tasks to others    | ✓     | ✓       |          |
 * | View all workspace CRM records     | ✓     | ✓       |          |
 * | View/edit own assigned records     | ✓     | ✓       | ✓        |
 * | Create customers/deals/tasks (own) | ✓     | ✓       | ✓        |
 * | Archive records (own / any)        | any   | any     | own      |
 * | Close deals (own / any)            | any   | any     | own      |
 *
 * Broader access must be explicit — never UI-only.
 */

export type Capability =
  | "company.settings"
  | "company.members"
  | "company.pipeline"
  | "company.automations"
  | "company.customFields"
  | "company.billing"
  | "company.export"
  | "crm.all"
  | "crm.assign"
  | "crm.create"
  | "audit.view";

const ROLE_CAPS: Record<Role, Capability[]> = {
  ADMIN: [
    "company.settings",
    "company.members",
    "company.pipeline",
    "company.automations",
    "company.customFields",
    "company.billing",
    "company.export",
    "crm.all",
    "crm.assign",
    "crm.create",
    "audit.view",
  ],
  MANAGER: ["crm.all", "crm.assign", "crm.create"],
  EMPLOYEE: ["crm.create"],
};

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPS[role]?.includes(capability) ?? false;
}

export function canAccessOwnedRecord(
  role: Role,
  recordOwnerId: string | null | undefined,
  userId: string,
): boolean {
  if (can(role, "crm.all")) return true;
  return recordOwnerId === userId;
}

export function assertCan(role: Role, capability: Capability): void {
  if (!can(role, capability)) {
    const err = new Error("Forbidden");
    (err as Error & { code: string; status: number }).code = "FORBIDDEN";
    (err as Error & { code: string; status: number }).status = 403;
    throw err;
  }
}

export function assertChatChannel(role: Role, channel: string): void {
  if (!["general", "sales", "support", "management"].includes(channel)) throw new Error("Invalid channel");
  if (channel === "management") assertCan(role, "crm.all");
}
