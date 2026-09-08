import { sql } from "drizzle-orm";
import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { branches } from "./branches";
import { memberStatusEnum } from "./enums";

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    /** Human-readable, printed on cards: BCN-SKP-00042 */
    memberCode: text("member_code").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    /** Stored full name column to optimize substring search via a single trigram index. */
    fullName: text("full_name").generatedAlwaysAs(
      sql`(first_name || ' ' || last_name)`,
    ),
    email: text("email"),
    phone: text("phone"),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    status: memberStatusEnum("status").notNull().default("active"),
    joinedOn: date("joined_on", { mode: "string" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    uniqueIndex("members_member_code_unique")
      .on(t.memberCode)
      .where(sql`${t.deletedAt} is null`),
    // Optimizes main member list view (branch + status filter, sorted by last name)
    index("members_branch_status_idx").on(t.branchId, t.status, t.lastName),
    index("members_created_at_idx").on(t.createdAt),
    index("members_full_name_trgm_idx").using(
      "gin",
      sql`${t.fullName} gin_trgm_ops`,
    ),
    index("members_email_trgm_idx").using("gin", sql`${t.email} gin_trgm_ops`),
    index("members_phone_idx").on(t.phone),
  ],
);
