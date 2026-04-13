import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    role: text("role").notNull().default("admin"),
    ...timestamps,
  },
  (table) => [check("users_role_check", sql`${table.role} IN ('admin', 'user')`)],
);

export const oauthAccounts = sqliteTable("oauth_accounts", {
  provider: text("provider").notNull(),
  providerUserId: text("provider_user_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ...timestamps,
});

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
});

export const teamMembers = sqliteTable("team_members", {
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
});

export const rolePermissions = sqliteTable("role_permissions", {
  role: text("role").notNull(),
  permission: text("permission").notNull(),
});

export const apiTokens = sqliteTable("api_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  name: text("name").notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  ...timestamps,
});

export const diagrams = sqliteTable("diagrams", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  amlContent: text("aml_content").notNull().default(""),
  layout: text("layout").notNull().default("{}"),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id),
  teamId: text("team_id").references(() => teams.id),
  ...timestamps,
});
