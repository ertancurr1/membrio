import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { SignInForm } from "./signin-form";

export const metadata: Metadata = { title: "Sign in · Membrio" };

const DEMO_ACCOUNT = [
  {
    label: "Super admin",
    email: "admin@membrio.demo",
    scope: "All 12 branches",
  },
  {
    label: "Regional admin",
    email: "regional.kosovo@membrio.demo",
    scope: "Prishtina + Prizren",
  },
  {
    label: "Branch admin",
    email: "admin.skopje@membrio.demo",
    scope: "Skopje only",
  },
  { label: "Staff", email: "staff1.skopje@membrio.demo", scope: "Skopje only" },
];

export default async function SignInPage() {
  if (await getActor()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Membrio</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Sign in to the Balkan Culture Network dashboard.
        </p>
      </div>

      <SignInForm />

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm font-medium text-neutral-900">Demo accounts</p>
        <p className="mt-1 text-xs text-neutral-600">
          Password for all accounts:{" "}
          <code className="font-mono">membrio-demo</code>. Each sees a different
          slice of the organisation.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {DEMO_ACCOUNT.map((account) => (
            <li key={account.email} className="text-xs">
              <span className="font-medium text-neutral-900">
                {account.label}
              </span>
              <span className="block font-mono text-neutral-600">
                {account.email}
              </span>
              <span className="block text-neutral-500">{account.scope}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
