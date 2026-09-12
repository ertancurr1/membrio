import type { Metadata } from "next";
import { db } from "@/db";
import { signOutAction } from "@/app/actions/auth";
import { requireActor } from "@/lib/actor";
import { listScopedBranches } from "@/lib/data/branches";
import { listMembers } from "@/lib/data/members";

export const metadata: Metadata = { title: "Dashboard · Membrio" };

type SearchParams = Promise<{ q?: string; branch?: string }>;

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  branch_admin: "Branch admin",
  staff: "Staff",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireActor();
  const { q, branch } = await searchParams;

  const scopedBranches = await listScopedBranches(db, actor);
  // Sanitizes branch search params against actor scope, gracefully falling back to default on stale URLs
  const branchId =
    branch && scopedBranches.some((b) => b.id === branch) ? branch : undefined;

  const { rows, total } = await listMembers(db, actor, {
    search: q,
    branchId,
    limit: 50,
  });

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Signed in as{" "}
            <span className="font-medium">
              {ROLE_LABELS[actor.role] ?? actor.role}
            </span>
            {" · "}
            {scopedBranches.length}{" "}
            {scopedBranches.length === 1 ? "branch" : "branches"} in scope
          </p>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="flex flex-wrap gap-2">
        <a
          href="/dashboard"
          className={`rounded-md border px-3 py-1.5 text-sm ${
            branchId
              ? "border-neutral-300 text-neutral-700"
              : "border-neutral-900 bg-neutral-900 text-white"
          }`}
        >
          All (
          {scopedBranches
            .reduce((sum, b) => sum + b.memberCount, 0)
            .toLocaleString()}
          )
        </a>
        {scopedBranches.map((b) => (
          <a
            key={b.id}
            href={`/dashboard?branch=${b.id}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              branchId === b.id
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 text-neutral-700"
            }`}
          >
            {b.name} ({b.memberCount.toLocaleString()})
          </a>
        ))}
      </section>

      <form action="/dashboard" method="get" className="flex gap-2">
        {branchId ? (
          <input type="hidden" name="branch" value={branchId} />
        ) : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name, email, phone, or member code"
          className="w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
        <button
          type="submit"
          className="rounded-md  bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Search
        </button>
      </form>

      <p className="text-sm text-neutral-600">
        {total.toLocaleString()} {total === 1 ? "member" : "members"}
        {q ? ` matching "${q}"` : ""}
        {rows.length < total ? ` · showing first ${rows.length}` : ""}
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Branch</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-neutral-500"
                >
                  No member match this view.
                </td>
              </tr>
            ) : (
              rows.map((member) => (
                <tr key={member.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2.5 font-mono text-xs text-neutral-600">
                    {member.memberCode}
                  </td>
                  <td className="px-4 py-2.5">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {member.branchName}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {member.status}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {member.joinedOn}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
