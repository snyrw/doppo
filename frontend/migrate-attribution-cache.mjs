import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

await sql.query(`
  CREATE TABLE IF NOT EXISTS attribution_cache (
    id text PRIMARY KEY,
    model_name text NOT NULL,
    prompt text NOT NULL,
    corrupted_prompt text NOT NULL,
    target_position text NOT NULL,
    target_token text NOT NULL,
    r2_key text,
    created_at timestamp DEFAULT now(),
    last_accessed_at timestamp
  )
`);

await sql.query(`
  CREATE INDEX IF NOT EXISTS attribution_cache_idx
    ON attribution_cache(model_name, prompt, corrupted_prompt, target_position, target_token)
`);

console.log("attribution_cache table ready.");
