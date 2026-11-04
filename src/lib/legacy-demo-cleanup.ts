import type { PrismaClient } from "@prisma/client";

const LEGACY_WORKSPACES = [
  { id: "company_alpha", slug: "demo-alpha" },
  { id: "company_beta", slug: "demo-beta" },
] as const;
const LEGACY_EMAILS = ["alpha", "beta"].flatMap((prefix) => ["admin", "manager", "employee"].map((role) => `${role}@demo-${prefix}.local`));
const USER_COLUMNS = new Set(["userId", "ownerId", "creatorId", "authorId", "actorId", "invitedById", "managerId", "siteLeadId", "createdById", "recordedById", "requestedById", "confirmedById"]);
function identifier(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("Unexpected database identifier");
  return `"${name}"`;
}
const placeholders = (values: string[]) => values.map(() => "?").join(",");

/** Destructive maintenance, called only by an explicit cleanup command, never by request startup.
 * Deletes the two exact legacy demo tenants; refuses cross-workspace references or identifier collisions.
 */
export async function removeLegacyDemoWorkspaces(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    const companies = await tx.company.findMany({ where: { id: { in: LEGACY_WORKSPACES.map((entry) => entry.id) } }, select: { id: true, slug: true } });
    if (companies.some((company) => !LEGACY_WORKSPACES.some((entry) => entry.id === company.id && entry.slug === company.slug))) throw new Error("Legacy workspace identifier is used by a non-demo workspace");
    const companyIds = companies.map((company) => company.id);
    const users = await tx.user.findMany({ where: { email: { in: LEGACY_EMAILS } }, select: { id: true } });
    const userIds = users.map((user) => user.id);
    const tables = await tx.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'");
    const tenantTables = [];
    for (const table of tables) {
      const columns = await tx.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info(${identifier(table.name)})`);
      if (!columns.some((column) => column.name === "companyId")) continue;
      const foreignKeys = await tx.$queryRawUnsafe<{ id: number; table: string; from: string; to: string }[]>(`PRAGMA foreign_key_list(${identifier(table.name)})`);
      tenantTables.push({ name: table.name, columns: columns.map((column) => column.name), parents: foreignKeys.map((key) => key.table), foreignKeys });
    }
    // Deleting a demo identity must not cascade into, detach ownership from, or modify a real workspace.
    if (userIds.length) for (const table of tenantTables) {
      const userColumns = table.columns.filter((column) => USER_COLUMNS.has(column));
      if (!userColumns.length) continue;
      const outside = companyIds.length ? `"companyId" NOT IN (${placeholders(companyIds)}) AND ` : "";
      const references = userColumns.map((column) => `${identifier(column)} IN (${placeholders(userIds)})`).join(" OR ");
      const rows = await tx.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM ${identifier(table.name)} WHERE ${outside}(${references})`, ...companyIds, ...userColumns.flatMap(() => userIds));
      if (Number(rows[0].count)) throw new Error("A legacy account is linked to a non-demo workspace; cleanup cancelled");
    }
    if (companyIds.length) {
      // Older databases can contain cross-tenant links. Do not let CASCADE/SET NULL alter another workspace.
      for (const child of tenantTables) for (const keyId of new Set(child.foreignKeys.map((key) => key.id))) {
        const keys = child.foreignKeys.filter((key) => key.id === keyId);
        const parent = tenantTables.find((table) => table.name === keys[0].table);
        if (!parent) continue;
        const join = keys.map((key) => `c.${identifier(key.from)} = p.${identifier(key.to)}`).join(" AND ");
        const rows = await tx.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM ${identifier(child.name)} c JOIN ${identifier(parent.name)} p ON ${join} WHERE c."companyId" NOT IN (${placeholders(companyIds)}) AND p."companyId" IN (${placeholders(companyIds)})`, ...companyIds, ...companyIds);
        if (Number(rows[0].count)) throw new Error("A non-demo record links to demo data; cleanup cancelled");
      }
      if (tenantTables.some((table) => table.name === "Invoice") && await tx.invoiceItem.count({ where: { invoice: { companyId: { notIn: companyIds } }, product: { companyId: { in: companyIds } } } })) throw new Error("A non-demo invoice uses a demo product; cleanup cancelled");
    }
    const documents = companyIds.length && tenantTables.some((table) => table.name === "ProjectDocument")
      ? await tx.projectDocument.findMany({ where: { companyId: { in: companyIds } }, select: { storageKey: true } }) : [];
    if (companyIds.length) {
      // Children are removed before referenced parents, keeping foreign-key enforcement enabled.
      const remaining = [...tenantTables];
      const ordered: typeof remaining = [];
      while (remaining.length) {
        const index = remaining.findIndex((candidate) => !remaining.some((other) => other.name !== candidate.name && other.parents.includes(candidate.name)));
        if (index === -1) throw new Error("Cyclic tenant dependencies; cleanup cancelled");
        ordered.push(...remaining.splice(index, 1));
      }
      for (const table of ordered) await tx.$executeRawUnsafe(`DELETE FROM ${identifier(table.name)} WHERE "companyId" IN (${placeholders(companyIds)})`, ...companyIds);
      await tx.company.deleteMany({ where: { id: { in: companyIds } } });
    }
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
    // Remove only unreferenced sample plans; existing real subscriptions retain their plans.
    await tx.plan.deleteMany({ where: { id: { in: ["plan_starter", "plan_growth"] }, subscriptions: { none: {} } } });
    const violations = await tx.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
    if (violations.length) throw new Error("Foreign-key check failed; cleanup cancelled");
    return { workspacesRemoved: companies.length, accountsRemoved: users.length, documentStorageKeys: documents.map((document) => document.storageKey) };
  }, { timeout: 30000 });
}
