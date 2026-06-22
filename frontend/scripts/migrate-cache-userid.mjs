// frontend/scripts/migrate-cache-userid.mjs
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);

const tables = ["heatmap_cache", "dla_cache", "attribution_cache", "steering_cache", "activation_patch_cache", "attn_cache"];
for (const t of tables) {
  await sql.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS user_id text`);
  await sql.query(`CREATE INDEX IF NOT EXISTS ${t}_user_idx ON ${t} (user_id)`);
  console.log(`migrated ${t}`);
}
console.log("done");
