import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "branch_admin",
  "staff",
]);

export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "inactive",
  "alumni",
  "suspended",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

export const checkInMethodEnum = pgEnum("check_in_method", [
  "qr",
  "manual",
  "import",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "soft_delete",
  "restore",
  "check_in",
  "check_in_undo",
  "export",
  "login",
]);
