import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/types";
import { getMemberById, listMembers } from "@/lib/data/members";
import { BranchAccessError, type Actor } from "@/lib/rbac";
import {
  createTestDb,
  resetDb,
  seedMemberDirectoryFixture,
} from "./helpers/db";

let db: Database;
let close: () => Promise<void>;
let fixture: Awaited<ReturnType<typeof seedMemberDirectoryFixture>>;
let superAdmin: Actor;
let northAdmin: Actor;

beforeAll(() => {
  ({ db, close } = createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await resetDb(db);
  fixture = await seedMemberDirectoryFixture(db);
  superAdmin = { id: fixture.users.admin.id, role: "super_admin" };
  northAdmin = { id: fixture.users.scopedAdmin.id, role: "branch_admin" };
});

describe("listMembers", () => {
  it("returns every branch for an unscoped actor and excludes soft-deleted rows", async () => {
    const result = await listMembers(db, superAdmin);
    expect(result.total).toBe(6);
    expect(result.rows.map((r) => r.memberCode)).not.toContain("D-NOR-9");
  });

  it("restricts results to the actor's branches", async () => {
    const result = await listMembers(db, northAdmin);
    expect(result.total).toBe(4);
    expect(
      result.rows.every((r) => r.branchId === fixture.branches.north.id),
    ).toBe(true);
  });

  it("rejects an explicit branch filter outside the actor's scope", async () => {
    await expect(
      listMembers(db, northAdmin, { branchId: fixture.branches.south.id }),
    ).rejects.toBeInstanceOf(BranchAccessError);
  });

  it("filters by status", async () => {
    const result = await listMembers(db, superAdmin, { status: "active" });
    expect(result.total).toBe(4);
  });

  it("searches across name, email, and member code", async () => {
    const byName = await listMembers(db, superAdmin, { search: "hoxha" });
    expect(byName.rows.map((r) => r.memberCode)).toEqual(["D-NOR-2"]);

    const byEmail = await listMembers(db, superAdmin, { search: "emir@" });
    expect(byEmail.rows.map((r) => r.memberCode)).toEqual(["D-SOU-1"]);

    const byCode = await listMembers(db, superAdmin, { search: "D-SOU" });
    expect(byCode.total).toBe(2);
  });

  it("treats LIKE metacharacters as literals", async () => {
    const result = await listMembers(db, superAdmin, { search: "100%" });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.lastName).toBe("100%Real");
  });

  it("applies search within scope, never across it", async () => {
    const result = await listMembers(db, northAdmin, { search: "zeqiri" });
    expect(result.total).toBe(0);
  });

  it("paginates with a stable total and clamps oversized windows", async () => {
    const page = await listMembers(db, superAdmin, { limit: 2, offset: 2 });
    expect(page.rows).toHaveLength(2);
    expect(page.total).toBe(6);

    const clamped = await listMembers(db, superAdmin, { limit: 10_000 });
    expect(clamped.limit).toBe(200);
  });

  it("enforces scope for a staff actor the same as any other role", async () => {
    await expect(
      listMembers(db, { id: fixture.users.scopedAdmin.id, role: "staff" }, {}),
    ).resolves.toBeDefined();

    await expect(
      listMembers(
        db,
        { id: fixture.users.scopedAdmin.id, role: "staff" },
        { branchId: fixture.branches.south.id },
      ),
    ).rejects.toBeInstanceOf(BranchAccessError);
  });
});

describe("getMemberById", () => {
  it("returns a member inside scope", async () => {
    const list = await listMembers(db, northAdmin, { search: "krasniqi" });
    const target = list.rows[0];
    expect(target).toBeDefined();

    const found = await getMemberById(db, northAdmin, target!.id);
    expect(found?.memberCode).toBe("D-NOR-1");
  });

  it("returns null rather than throwing for a member outside scope", async () => {
    const list = await listMembers(db, superAdmin, { search: "zeqiri" });
    const target = list.rows[0];
    expect(target).toBeDefined();

    const found = await getMemberById(db, northAdmin, target!.id);
    expect(found).toBeNull();
  });

  it("returns null for a soft-deleted member", async () => {
    const found = await getMemberById(db, superAdmin, fixture.softDeleted.id);
    expect(found).toBeNull();
  });
});
