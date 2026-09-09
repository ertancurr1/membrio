import { eq, inArray, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { userBranches } from "@/db/schema";
import type { Database } from "@/db/types";

export type UserRole = "super_admin" | "branch_admin" | "staff";

export type Actor = {
  id: string;
  role: UserRole;
};

export type Permission =
  | "member:read"
  | "member:create"
  | "member:update"
  | "member:delete"
  | "event:read"
  | "event:create"
  | "event:update"
  | "event:delete"
  | "attendance:create"
  | "attendance:delete"
  | "audit:read"
  | "export:data"
  | "user:manage"
  | "branch:manage";

const ALL_PERMISSIONS: readonly Permission[] = [
  "member:read",
  "member:create",
  "member:update",
  "member:delete",
  "event:read",
  "event:create",
  "event:update",
  "event:delete",
  "attendance:create",
  "attendance:delete",
  "audit:read",
  "export:data",
  "user:manage",
  "branch:manage",
];

/**
 * Defines role capability permissions (requires separate branch scope validation)
 */
const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  branch_admin: [
    "member:read",
    "member:create",
    "member:update",
    "member:delete",
    "event:read",
    "event:create",
    "event:update",
    "event:delete",
    "attendance:create",
    "attendance:delete",
    "audit:read",
    "export:data",
  ],
  staff: [
    "member:read",
    "member:create",
    "member:update",
    "event:read",
    "attendance:create",
  ],
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export type BranchScope =
  | { kind: "all" }
  | { kind: "some"; branchIds: string[] };

export async function resolveBranchScope(
  db: Database,
  actor: Actor,
): Promise<BranchScope> {
  if (actor.role === "super_admin") return { kind: "all" };

  const rows = await db
    .select({ branchId: userBranches.branchId })
    .from(userBranches)
    .where(eq(userBranches.userId, actor.id));

  return { kind: "some", branchIds: rows.map((row) => row.branchId) };
}

/**
 * Generates a SQL scoping clause for branch-owned tables, handling global access (undefined)
 * and safely defaulting empty scopes to false.
 */
export function branchScopeFilter(
  scope: BranchScope,
  column: PgColumn,
): SQL | undefined {
  if (scope.kind === "all") return undefined;
  if (scope.branchIds.length === 0) return sql`false`;
  return inArray(column, scope.branchIds);
}

export class BranchAccessError extends Error {
  constructor(branchId: string) {
    super(`Actor is not scoped to branch ${branchId}`);
    this.name = "BranchAccessError";
  }
}

export class PermissionError extends Error {
  constructor(permission: Permission) {
    super(`Actor lacks permission ${permission}`);
    this.name = "PermissionError";
  }
}

/**
 * Validates that an actor holds the required permission capability and branch access.
 *
 * @throws {PermissionError} If the actor's role lacks the permission
 * @throws {BranchAccessError} If the target branch is outside the actor's scope
 */
export async function authorize(
  db: Database,
  actor: Actor,
  permission: Permission,
  branchId: string,
): Promise<void> {
  if (!can(actor.role, permission)) throw new PermissionError(permission);

  const scope = await resolveBranchScope(db, actor);
  if (scope.kind === "all") return;
  if (!scope.branchIds.includes(branchId))
    throw new BranchAccessError(branchId);
}
