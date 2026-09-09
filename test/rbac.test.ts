import { and, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { members } from "@/db/schema";
import type { Database } from "@/db/types";
import {
  BranchAccessError,
  PermissionError,
  authorize,
  branchScopeFilter,
  can,
  resolveBranchScope,
} from "@/lib/rbac";
import {
  createTestDb,
  resetDb,
  seedRbacFixture,
  type RbacFixture,
} from "./helpers/db";

let db: Database;
let close: () => Promise<void>;
let fixture: RbacFixture;

beforeAll(() => {
  ({ db, close } = createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await resetDb(db);
  fixture = await seedRbacFixture(db);
});

describe("resolveBranchScope", () => {
  it("gives super_admin unrestricted scope without enumerating branches", async () => {
    const scope = await resolveBranchScope(db, {
      id: fixture.users.superAdmin.id,
      role: "super_admin",
    });
    expect(scope).toEqual({ kind: "all" });
  });

  it("returns exactly the assigned branches for a multi-branch admin", async () => {
    const scope = await resolveBranchScope(db, {
      id: fixture.users.regional.id,
      role: "branch_admin",
    });

    expect(scope.kind).toBe("some");
    if (scope.kind !== "some") return;
    expect(new Set(scope.branchIds)).toEqual(
      new Set([fixture.branches.alpha.id, fixture.branches.beta.id]),
    );
  });

  it("returns an empty scope for an admin with no assignments", async () => {
    const scope = await resolveBranchScope(db, {
      id: fixture.users.orphan.id,
      role: "branch_admin",
    });
    expect(scope).toEqual({ kind: "some", branchIds: [] });
  });
});

describe("branchScopeFilter", () => {
  it("returns no filter for super_admin so all branches are visible", async () => {
    const scope = await resolveBranchScope(db, {
      id: fixture.users.superAdmin.id,
      role: "super_admin",
    });

    const rows = await db
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          isNull(members.deletedAt),
          branchScopeFilter(scope, members.branchId),
        ),
      );

    expect(rows).toHaveLength(4);
  });

  it("restricts a query to the actor's branches", async () => {
    const scope = await resolveBranchScope(db, {
      id: fixture.users.regional.id,
      role: "branch_admin",
    });

    const rows = await db
      .select({ branchId: members.branchId })
      .from(members)
      .where(
        and(
          isNull(members.deletedAt),
          branchScopeFilter(scope, members.branchId),
        ),
      );

    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.branchId !== fixture.branches.gamma.id)).toBe(
      true,
    );
  });

  // Verifies that empty branch scopes yield zero results to guard against unscoped data leaks
  it("returns nothing, not everything, for an empty scope", async () => {
    const scope = await resolveBranchScope(db, {
      id: fixture.users.orphan.id,
      role: "branch_admin",
    });

    const rows = await db
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          isNull(members.deletedAt),
          branchScopeFilter(scope, members.branchId),
        ),
      );

    expect(rows).toHaveLength(0);
  });
});

describe("can", () => {
  it("withholds destructive permissions from staff", () => {
    expect(can("staff", "member:delete")).toBe(false);
    expect(can("staff", "event:create")).toBe(false);
    expect(can("staff", "attendance:create")).toBe(true);
  });

  it("grants branch admins management but not user administration", () => {
    expect(can("branch_admin", "member:delete")).toBe(true);
    expect(can("branch_admin", "audit:read")).toBe(true);
    expect(can("branch_admin", "user:manage")).toBe(false);
  });
});

describe("authorize", () => {
  it("allows an in-scope action", async () => {
    await expect(
      authorize(
        db,
        { id: fixture.users.regional.id, role: "branch_admin" },
        "member:update",
        fixture.branches.alpha.id,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects an out-of-scope branch even with the right role", async () => {
    await expect(
      authorize(
        db,
        { id: fixture.users.regional.id, role: "branch_admin" },
        "member:update",
        fixture.branches.gamma.id,
      ),
    ).rejects.toBeInstanceOf(BranchAccessError);
  });

  it("rejects a permission the role lacks even inside scope", async () => {
    await expect(
      authorize(
        db,
        { id: fixture.users.staff.id, role: "staff" },
        "member:delete",
        fixture.branches.alpha.id,
      ),
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("lets super_admin act on a branch it was never assigned to", async () => {
    await expect(
      authorize(
        db,
        { id: fixture.users.superAdmin.id, role: "super_admin" },
        "branch:manage",
        fixture.branches.gamma.id,
      ),
    ).resolves.toBeUndefined();
  });
});
