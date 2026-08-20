// frontend/scripts/query-usage-raw.mjs — read-only, dumps every usage row per tier
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const rows = await sql.query(`
  select job_tier, -amount_micros as micros, job_duration_ms, created_at
  from credit_ledger
  where type = 'usage'
  order by job_tier, micros;
`);
console.log(JSON.stringify(rows, null, 2));
