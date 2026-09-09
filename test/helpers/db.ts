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

/**
 * Seeds an isolated member directory dataset for listing, pagination, and search filter tests.
 *
 * Configures multi-branch reecords, varying statuses, nullable contact fields, soft-deleted rows,
 * and edge-case strings  (e.g.literal '%' characters) to verify wildcard escaping and scoping
 */
export async function seedMemberDirectoryFixture(db: Database) {
  const [north, south] = await db
    .insert(schema.branches)
    .values([
      {
        code: "NOR",
        slug: "north",
        name: "North",
        city: "North",
        country: "Testland",
      },
      {
        code: "SOU",
        slug: "south",
        name: "South",
        city: "South",
        country: "Testland",
      },
    ])
    .returning();

  if (!north || !south) throw new Error("Branch fixture failed");

  const [admin, scopedAdmin] = await db
    .insert(schema.users)
    .values([
      { email: "dir-super@test.local", name: "Dir Super", role: "super_admin" },
      {
        email: "dir-north@test.local",
        name: "Dir North",
        role: "branch_admin",
      },
    ])
    .returning();

  if (!admin || !scopedAdmin) throw new Error("User fixture failed");

  await db
    .insert(schema.userBranches)
    .values([{ userId: scopedAdmin.id, branchId: north.id }]);

  await db.insert(schema.members).values([
    {
      branchId: north.id,
      memberCode: "D-NOR-1",
      firstName: "Arben",
      lastName: "Krasniqi",
      email: "arben@example.org",
      phone: "+38970111111",
      status: "active",
      joinedOn: "2024-01-01",
    },
    {
      branchId: north.id,
      memberCode: "D-NOR-2",
      firstName: "Blerta",
      lastName: "Hoxha",
      email: "blerta@example.org",
      phone: "+38970222222",
      status: "inactive",
      joinedOn: "2024-02-01",
    },
    {
      branchId: north.id,
      memberCode: "D-NOR-3",
      firstName: "Cemal",
      lastName: "Ademi",
      email: null,
      phone: null,
      status: "active",
      joinedOn: "2024-03-01",
    },
    // Test member fixture with literal SQL wildcard characters to verify LIKE escaping (%)
    {
      branchId: north.id,
      memberCode: "D-NOR-4",
      firstName: "Dea",
      lastName: "100%Real",
      email: null,
      phone: null,
      status: "active",
      joinedOn: "2024-04-01",
    },
    {
      branchId: south.id,
      memberCode: "D-SOU-1",
      firstName: "Emir",
      lastName: "Zeqiri",
      email: "emir@example.org",
      phone: "+38970333333",
      status: "active",
      joinedOn: "2024-05-01",
    },
    {
      branchId: south.id,
      memberCode: "D-SOU-2",
      firstName: "Fatmir",
      lastName: "Berisha",
      email: null,
      phone: null,
      status: "alumni",
      joinedOn: "2024-06-01",
    },
  ]);

  const soft = await db
    .insert(schema.members)
    .values({
      branchId: north.id,
      memberCode: "D-NOR-9",
      firstName: "Gone",
      lastName: "Deleted",
      joinedOn: "2024-07-01",
      deletedAt: new Date(),
    })
    .returning();

  return {
    branches: { north, south },
    users: { admin, scopedAdmin },
    softDeleted: soft[0]!,
  };
}
