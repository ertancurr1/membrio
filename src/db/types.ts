import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

/**
 * Standalone DB type isolated from connection side-effects for safe imports in tests and utilities.
 */
export type Database = PostgresJsDatabase<typeof schema>;
