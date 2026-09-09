import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import type { Database } from "@/db/types";
import { testDatabaseUrl } from "../env";

export type TestDb = {
  db: Database;
  close: () => Promise<void>;
};

export function createTestDb(): TestDb {
  const client = postgres(testDatabaseUrl(), { max: 1, prepare: false });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}

export async function resetDb(db: Database): Promise<void> {
  await db.execute(sql`
        truncate table
            ${schema.attendance},
            ${schema.auditLogs},
            ${schema.events},
            ${schema.members},
            ${schema.userBranches},
            ${schema.accounts},
            ${schema.sessions},
            ${schema.verificationTokens},
            ${schema.users},
            ${schema.branches}
        restart identity cascade
    `);
}

export type RbacFixture = Awaited<ReturnType<typeof seedRbacFixture>>;

/**
 * Seeds a lightweight, deterministic dataset designed specifically for testing RBAC scope resolution
 *
 * Populates teest branches, distinct role setups (super admin, regional, local unassigned orphan, staff),
 * and minimal member records
 */
export async function seedRbacFixture(db: Database) {
  const [alpha, beta, gamma] = await db
    .insert(schema.branches)
    .values([
      {
        code: "ALP",
        slug: "alpha",
        name: "Alpha",
        city: "Alpha",
        country: "Testland",
      },
      {
        code: "BET",
        slug: "beta",
        name: "Beta",
        city: "Beta",
        country: "Testland",
      },
      {
        code: "GAM",
        slug: "gamma",
        name: "Gamma",
        city: "Gamma",
        country: "Testland",
      },
    ])
    .returning();

  if (!alpha || !beta || !gamma) throw new Error("Branch fixture failed");

  const [superAdmin, regional, local, orphan, staff] = await db
    .insert(schema.users)
    .values([
      { email: "super@test.local", name: "Super", role: "super_admin" },
      { email: "regional@test.local", name: "Regional", role: "branch_admin" },
      { email: "local@test.local", name: "Local", role: "branch_admin" },
      { email: "orphan@test.local", name: "Orphan", role: "branch_admin" },
      { email: "staff@test.local", name: "Staff", role: "staff" },
    ])
    .returning();

  if (!superAdmin || !regional || !local || !orphan || !staff) {
    throw new Error("User fixture failed");
  }

  await db.insert(schema.userBranches).values([
    { userId: regional.id, branchId: alpha.id },
    { userId: regional.id, branchId: beta.id },
    { userId: local.id, branchId: gamma.id },
    { userId: staff.id, branchId: alpha.id },
    // orphan intentionally has no assignments
  ]);

  await db.insert(schema.members).values([
    {
      branchId: alpha.id,
      memberCode: "T-ALP-1",
      firstName: "Ana",
      lastName: "One",
      joinedOn: "2024-01-01",
    },
    {
      branchId: alpha.id,
      memberCode: "T-ALP-2",
      firstName: "Bes",
      lastName: "Two",
      joinedOn: "2024-01-02",
    },
    {
      branchId: beta.id,
      memberCode: "T-BET-1",
      firstName: "Cem",
      lastName: "Three",
      joinedOn: "2024-01-03",
    },
    {
      branchId: gamma.id,
      memberCode: "T-GAM-1",
      firstName: "Dea",
      lastName: "Four",
      joinedOn: "2024-01-04",
    },
  ]);

  return {
    branches: { alpha, beta, gamma },
    users: { superAdmin, regional, local, orphan, staff },
  };
}
