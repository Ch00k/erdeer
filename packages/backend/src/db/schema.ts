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

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  ...timestamps,
});

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

export const teamMembers = sqliteTable(
  "team_members",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("member"),
    ...timestamps,
  },
  (table) => [check("team_members_role_check", sql`${table.role} IN ('owner', 'member')`)],
);

export const teamInvitations = sqliteTable(
  "team_invitations",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    invitedEmail: text("invited_email").notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("pending"),
    ...timestamps,
  },
  (table) => [
    check(
      "team_invitations_status_check",
      sql`${table.status} IN ('pending', 'accepted', 'declined')`,
    ),
  ],
);

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

export const diagrams = sqliteTable(
  "diagrams",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    amlContent: text("aml_content").notNull().default(""),
    layout: text("layout").notNull().default("{}"),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id),
    teamId: text("team_id").references(() => teams.id),
    visibility: text("visibility").notNull().default("private"),
    ...timestamps,
  },
  (table) => [
    check("diagrams_visibility_check", sql`${table.visibility} IN ('private', 'public')`),
  ],
);
