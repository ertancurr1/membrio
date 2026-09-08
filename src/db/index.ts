import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

/**
 * Initializes the Drizzle DB client with Supabase pooler compatibility (prepare: false)
 * and singleton connection reuse for non-production environments
 */
const conn =
  globalForDb.conn ??
  postgres(env.DATABASE_URL, {
    max: 10,
    prepare: false,
  });

if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, {
  schema,
  logger: env.NODE_ENV === "development",
});

export type Db = typeof db;
