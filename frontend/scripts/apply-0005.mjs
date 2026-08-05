// Applies migrations/0005_steering_pair_sets.sql — drizzle-kit migrate/push
// hangs in non-TTY shells (websocket transport), so run the DDL directly
// over neon-http.
//   node scripts/apply-0005.mjs
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

await sql.query(`
  CREATE TABLE IF NOT EXISTS "steering_pair_sets" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "clean_prompt" text NOT NULL,
    "corrupted_prompt" text NOT NULL,
    "extra_pairs" jsonb NOT NULL DEFAULT '[]',
    "created_at" timestamp NOT NULL DEFAULT now()
  )
`);

await sql.query(`
  CREATE INDEX IF NOT EXISTS "steering_pair_sets_user_idx"
  ON "steering_pair_sets" ("user_id")
`);

const check = await sql.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'steering_pair_sets'
  ORDER BY ordinal_position
`);
console.log("steering_pair_sets columns:", check.map((r) => r.column_name));
console.log("Done.");