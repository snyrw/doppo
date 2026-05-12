import { pgTable, text, timestamp, index, boolean, jsonb } from "drizzle-orm/pg-core";

export const heatmapCache = pgTable(
  "heatmap_cache",
  {
    id: text("id").primaryKey(),
    prompt: text("prompt").notNull(),
    modelName: text("model_name").notNull(),
    r2Key: text("r2_key"),
    createdAt: timestamp("created_at").defaultNow(),
    lastAccessedAt: timestamp("last_accessed_at"),
  },
  (table) => [
    index("prompt_model_idx").on(table.prompt, table.modelName),
  ]
);

export const dlaCache = pgTable(
  "dla_cache",
  {
    id: text("id").primaryKey(),
    modelName: text("model_name").notNull(),
    prompt: text("prompt").notNull(),
    targetPosition: text("target_position").notNull(),
    targetToken: text("target_token").notNull(),
    r2Key: text("r2_key"),
    createdAt: timestamp("created_at").defaultNow(),
    lastAccessedAt: timestamp("last_accessed_at"),
  },
  (table) => [
    index("dla_prompt_model_idx").on(table.modelName, table.prompt, table.targetPosition, table.targetToken),
  ]
);

// BetterAuth required tables
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const project = pgTable("project", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Untitled Project"),
  cards: jsonb("cards").notNull().default([]),
  canvas: jsonb("canvas").notNull().default({ panOffset: { x: 0, y: 0 }, zoom: 1 }),
  isPublic: boolean("is_public").notNull().default(false),
  shareId: text("share_id").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
