import { describe, expect, it } from "vitest";
import { can, canAccessOwnedRecord } from "@/lib/permissions";

describe("permissions matrix", () => {
  it("allows admins to manage company settings", () => {
    expect(can("ADMIN", "company.settings")).toBe(true);
    expect(can("MANAGER", "company.settings")).toBe(false);
    expect(can("EMPLOYEE", "company.settings")).toBe(false);
  });

  it("allows managers full CRM access but not billing", () => {
    expect(can("MANAGER", "crm.all")).toBe(true);
    expect(can("MANAGER", "crm.assign")).toBe(true);
    expect(can("MANAGER", "company.billing")).toBe(false);
  });

  it("restricts employees to owned records", () => {
    expect(can("EMPLOYEE", "crm.all")).toBe(false);
    expect(canAccessOwnedRecord("EMPLOYEE", "u1", "u1")).toBe(true);
    expect(canAccessOwnedRecord("EMPLOYEE", "u2", "u1")).toBe(false);
    expect(canAccessOwnedRecord("MANAGER", "u2", "u1")).toBe(true);
  });
});
