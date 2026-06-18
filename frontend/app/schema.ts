import { pgTable, text, timestamp, index, boolean, jsonb, integer, bigint } from "drizzle-orm/pg-core";

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

export const attributionCache = pgTable(
  "attribution_cache",
  {
    id: text("id").primaryKey(),
    modelName: text("model_name").notNull(),
    prompt: text("prompt").notNull(),
    corruptedPrompt: text("corrupted_prompt").notNull(),
    targetPosition: text("target_position").notNull(),
    targetToken: text("target_token").notNull(),
    r2Key: text("r2_key"),
    createdAt: timestamp("created_at").defaultNow(),
    lastAccessedAt: timestamp("last_accessed_at"),
  },
  (table) => [
    index("attribution_cache_idx").on(
      table.modelName, table.prompt, table.corruptedPrompt,
      table.targetPosition, table.targetToken
    ),
  ]
);

export const steeringCache = pgTable("steering_cache", {
  id: text("id").primaryKey(),
  modelName: text("model_name").notNull(),
  cleanPrompt: text("clean_prompt").notNull(),
  corruptedPrompt: text("corrupted_prompt").notNull(),
  r2Key: text("r2_key"),
  createdAt: timestamp("created_at").defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at"),
});

export const activationPatchCache = pgTable("activation_patch_cache", {
  id: text("id").primaryKey(),
  modelName: text("model_name").notNull(),
  cleanPrompt: text("clean_prompt").notNull(),
  corruptedPrompt: text("corrupted_prompt").notNull(),
  r2Key: text("r2_key"),
  createdAt: timestamp("created_at").defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at"),
});

export const attnCache = pgTable("attn_cache", {
  id: text("id").primaryKey(),
  modelName: text("model_name").notNull(),
  prompt: text("prompt").notNull(),
  r2Key: text("r2_key"),
  createdAt: timestamp("created_at").defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at"),
});

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

export const userCredits = pgTable("user_credits", {
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .primaryKey(),
  balanceMicros: bigint("balance_micros", { mode: "number" }).notNull().default(0),
  lastFreeGrantMonth: text("last_free_grant_month"), // YYYY-MM, nullable
  stripeCustomerId: text("stripe_customer_id"), // cus_… ; created lazily on first gate hit
  paymentVerifiedAt: timestamp("payment_verified_at"), // set by setup session OR purchase
});

export const creditLedger = pgTable("credit_ledger", {
  id: text("id").notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "free_grant" | "purchase" | "usage"
  amountMicros: bigint("amount_micros", { mode: "number" }).notNull(),
  jobTier: text("job_tier"),
  jobDurationMs: integer("job_duration_ms"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activeJobs = pgTable("active_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  gpuTier: text("gpu_tier").notNull(),
  jobType: text("job_type").notNull(),
  modelName: text("model_name").notNull(),
  cacheKey: text("cache_key"),
  cachePayload: text("cache_payload"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
});
