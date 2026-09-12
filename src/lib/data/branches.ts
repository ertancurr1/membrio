import { and, asc, count, eq, isNull, type SQL } from "drizzle-orm";
import { branches, members } from "@/db/schema";
import type { Database } from "@/db/types";
import {
  PermissionError,
  branchScopeFilter,
  can,
  resolveBranchScope,
  type Actor,
} from "@/lib/rbac";

export type ScopedBranch = {
  id: string;
  code: string;
  name: string;
  city: string;
  memberCount: number;
};

/**
 * Fetches non-deleted branches accessible to the actor, aggregated with live active member counts
 *
 * Used to populate UI branch navigation tabs while reflecting actor scoping boundaries directly in the interface
 *
 * @throws {PermissionError} if the actor lacks member:read capability.
 */
export async function listScopedBranches(
  db: Database,
  actor: Actor,
): Promise<ScopedBranch[]> {
  if (!can(actor.role, "member:read")) throw new PermissionError("member:read");

  const scope = await resolveBranchScope(db, actor);

  const conditions: SQL[] = [isNull(branches.deletedAt)];
  const scopeFilter = branchScopeFilter(scope, branches.id);
  if (scopeFilter) conditions.push(scopeFilter);

  return (
    db
      .select({
        id: branches.id,
        code: branches.code,
        name: branches.name,
        city: branches.city,
        memberCount: count(members.id),
      })
      .from(branches)
      // LEFT JOIN with soft-delete in the ON clause to preserve zero-member branches in tab UI
      .leftJoin(
        members,
        and(eq(members.branchId, branches.id), isNull(members.deletedAt)),
      )
      .where(and(...conditions))
      .groupBy(branches.id, branches.code, branches.name, branches.city)
      .orderBy(asc(branches.name))
  );
}
