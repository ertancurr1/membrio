import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { branches } from "./branches";
import { checkInMethodEnum, eventStatusEnum } from "./enums";

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: timestamp("starts_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    capacity: integer("capacity"),
    status: eventStatusEnum("status").notNull().default("draft"),
    /** Unique, rotatable secret token embedded in event QR codes */
    checkInToken: uuid("check_in_token").notNull().defaultRandom(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    uniqueIndex("events_check_in_token_unique").on(t.checkInToken),
    index("events_branch_starts_at_idx").on(t.branchId, t.startsAt),
    index("events_status_starts_at_idx").on(t.status, t.startsAt),
  ],
);

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    checkedInAt: timestamp("checked_in_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    method: checkInMethodEnum("method").notNull().default("qr"),
    checkedInByUserId: uuid("checked_in_by_user_id").references(
      () => users.id,
      {
        onDelete: "set null",
      },
    ),
    note: text("note"),
  },
  (t) => [
    // Prevents duplicate check-ins for the same member and event
    uniqueIndex("attendance_event_member_unique").on(t.eventId, t.memberId),
    index("attendance_event_idx").on(t.eventId, t.checkedInAt),
    // Pre-sorted index for fast recent attendance lookups per member
    index("attendance_member_recent_idx").on(t.memberId, t.checkedInAt.desc()),
  ],
);

// Placed last to break circular type dependencies across foreign key relations
import { members } from "./members";
