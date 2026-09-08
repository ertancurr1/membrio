import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Short stable code used in member codes, e.g. "SKP" */
    code: text("code").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    country: text("country").notNull(),
    timezone: text("timezone").notNull().default("Europe/Skopje"),
    address: text("address"),
    foundedOn: timestamp("founded_on", { withTimezone: true, mode: "date" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    uniqueIndex("branches_slug_unique")
      .on(t.slug)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex("branches_code_unique")
      .on(t.code)
      .where(sql`${t.deletedAt} is null`),
    index("branches_active_idx")
      .on(t.isActive)
      .where(sql`${t.deletedAt} is null`),
  ],
);

/**
 * Maps user roles (users.role) to applicable branches.
 * Note: super_admin bypasses scoping and requires no entries here.
 */
export const userBranches = pgTable(
  "user_branches",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.branchId] }),
    index("user_branches_branch_id_idx").on(t.branchId),
  ],
);
