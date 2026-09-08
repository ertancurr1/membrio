import { relations } from "drizzle-orm";
import { users } from "./auth";
import { auditLogs } from "./audit";
import { branches, userBranches } from "./branches";
import { attendance, events } from "./events";
import { members } from "./members";

export const userRelations = relations(users, ({ many }) => ({
  branchAssignments: many(userBranches),
  auditLogs: many(auditLogs),
}));

export const branchesRelations = relations(branches, ({ many }) => ({
  members: many(members),
  events: many(events),
  userAssignments: many(userBranches),
}));

export const userBranchesRelations = relations(userBranches, ({ one }) => ({
  user: one(users, {
    fields: [userBranches.userId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [userBranches.branchId],
    references: [branches.id],
  }),
}));

export const memberRelations = relations(members, ({ one, many }) => ({
  branch: one(branches, {
    fields: [members.branchId],
    references: [branches.id],
  }),
  attendance: many(attendance),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  branch: one(branches, {
    fields: [events.branchId],
    references: [branches.id],
  }),
  attendance: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  event: one(events, {
    fields: [attendance.eventId],
    references: [events.id],
  }),
  member: one(members, {
    fields: [attendance.memberId],
    references: [members.id],
  }),
  checkedInBy: one(users, {
    fields: [attendance.checkedInByUserId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [auditLogs.branchId],
    references: [branches.id],
  }),
}));
