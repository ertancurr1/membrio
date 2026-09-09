import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";
import { branches, members } from "@/db/schema";
import type { Database } from "@/db/types";
import {
  BranchAccessError,
  PermissionError,
  branchScopeFilter,
  can,
  resolveBranchScope,
  type Actor,
} from "@/lib/rbac";

export type MemberStatus = "active" | "inactive" | "alumni" | "suspended";
export type MemberSortField = "name" | "joinedOn" | "createdAt";
export type SortDirection = "asc" | "desc";

export type ListMembersParams = {
  /** Optional branch ID to narrow query results, must fall within the actor's assigned branch scope */
  branchId?: string;
  status?: MemberStatus;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: MemberSortField;
  direction?: SortDirection;
};

export type MemberListRow = {
  id: string;
  memberCode: string;
  firstName: string;
  lastName: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  status: MemberStatus;
  joinedOn: string;
  branchId: string;
  branchName: string;
  branchCode: string;
};

export type ListMembersResult = {
  rows: MemberListRow[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 50;
/** Maximum number of rows a virtualized table can request in a single round trip */
const MAX_LIMIT = 200;
/**
 * Trigram indexes require at least 3 characters for index acceleration.
 * 2-character searches will execute via sequential scan, but 1-character queries
 * are ignored entirely to limit DB load on early keystrokes
 */
const MIN_SEARCH_LENGTH = 2;

/**
 * Escapes SQL LIKE and ILIKE metacharacters (%, _, \) so user queries
 * match raw string literals rather than wildcards
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

function clampOffset(offset: number | undefined): number {
  if (offset === undefined) return 0;
  if (!Number.isFinite(offset) || offset < 0) return 0;
  return Math.floor(offset);
}

/**
 * Centralized reader for members that enforces RBAC capabilities, actor branch scoping,
 * pagination constraints, and search filtering before executing parallel data and count queries
 *
 * @throws {PermissionError} if the actor lacks member:read capability.
 * @throws {BranchAccessError} if the explicitly requested branch is outside the actor's scope
 */
export async function listMembers(
  db: Database,
  actor: Actor,
  params: ListMembersParams = {},
): Promise<ListMembersResult> {
  if (!can(actor.role, "member:read")) throw new PermissionError("member:read");

  const scope = await resolveBranchScope(db, actor);

  if (params.branchId !== undefined) {
    if (scope.kind === "some" && !scope.branchIds.includes(params.branchId)) {
      throw new BranchAccessError(params.branchId);
    }
  }

  const limit = clampLimit(params.limit);
  const offset = clampOffset(params.offset);

  const conditions: SQL[] = [isNull(members.deletedAt)];

  const scopeFilter = branchScopeFilter(scope, members.branchId);
  if (scopeFilter) conditions.push(scopeFilter);

  if (params.branchId !== undefined) {
    conditions.push(eq(members.branchId, params.branchId));
  }

  if (params.status !== undefined) {
    conditions.push(eq(members.status, params.status));
  }

  const search = params.search?.trim();
  if (search && search.length >= MIN_SEARCH_LENGTH) {
    const pattern = `%${escapeLikePattern(search)}%`;
    const matches = or(
      ilike(members.fullName, pattern),
      ilike(members.email, pattern),
      ilike(members.memberCode, pattern),
      ilike(members.phone, pattern),
    );
    if (matches) conditions.push(matches);
  }

  const where = and(...conditions);
  const direction = params.direction ?? "asc";
  const dir = direction === "asc" ? asc : desc;

  // Applies primary key tiebreakers to sorting expression for stable virtualized pagination
  const orderBy =
    params.sort === "joinedOn"
      ? [dir(members.joinedOn), asc(members.id)]
      : params.sort === "createdAt"
        ? [dir(members.createdAt), asc(members.id)]
        : [dir(members.lastName), dir(members.firstName), asc(members.id)];

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: members.id,
        memberCode: members.memberCode,
        firstName: members.firstName,
        lastName: members.lastName,
        fullName: members.fullName,
        email: members.email,
        phone: members.phone,
        status: members.status,
        joinedOn: members.joinedOn,
        branchId: members.branchId,
        branchName: branches.name,
        branchCode: branches.code,
      })
      .from(members)
      .innerJoin(branches, eq(branches.id, members.branchId))
      .where(where)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(members).where(where),
  ]);

  return {
    rows,
    total: totalResult[0]?.value ?? 0,
    limit,
    offset,
  };
}

/**
 * Fetches a member by ID within the actor's branch scope, returning null for both missing
 * and out-of-scope records to prevent cross-tenant resource numeration
 *
 * @throws {PermissionError} if the actor lacks member:read capability
 */
export async function getMemberById(
  db: Database,
  actor: Actor,
  memberId: string,
): Promise<MemberListRow | null> {
  if (!can(actor.role, "member:read")) throw new PermissionError("member:read");

  const scope = await resolveBranchScope(db, actor);

  const conditions: SQL[] = [
    eq(members.id, memberId),
    isNull(members.deletedAt),
  ];
  const scopeFilter = branchScopeFilter(scope, members.branchId);
  if (scopeFilter) conditions.push(scopeFilter);

  const rows = await db
    .select({
      id: members.id,
      memberCode: members.memberCode,
      firstName: members.firstName,
      lastName: members.lastName,
      fullName: members.fullName,
      email: members.email,
      phone: members.phone,
      status: members.status,
      joinedOn: members.joinedOn,
      branchId: members.branchId,
      branchName: branches.name,
      branchCode: branches.code,
    })
    .from(members)
    .innerJoin(branches, eq(branches.id, members.branchId))
    .where(and(...conditions))
    .limit(1);

  return rows[0] ?? null;
}
