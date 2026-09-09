import { auth } from "@/lib/auth";
import type { Actor } from "@/lib/rbac";

export class UnauthenticatedError extends Error {
  constructor() {
    super("No authenticated session");
    this.name = "UnauthenticatedError";
  }
}

/**
 * Resolves the authenticated actor from the current session context, returning null
 * when unauthenticated or lacking identity claims
 */
export async function getActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, role: session.user.role };
}

/**
 * Resolves the current actor context or throws an exception if no valid session exists
 *
 * Use within Server Components, Server Actions, and API route handlers where
 * authentication is strictly mandatory
 *
 * @return the authenticated actor context
 * @throws {UnauthenticatedError} if the request is unauthenticated or missing identity claims
 */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new UnauthenticatedError();
  return actor;
}
