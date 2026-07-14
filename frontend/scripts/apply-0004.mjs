// Applies migrations/0004_ledger_tombstone.sql — drops the cascading FK on
// credit_ledger.user_id. drizzle-kit migrate/push hangs in non-TTY shells
// (websocket transport), so run the DDL directly over neon-http.
//   node scripts/apply-0004.mjs
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const before = await sql.query(`
  SELECT conname FROM pg_constraint
  WHERE conrelid = 'credit_ledger'::regclass AND contype = 'f'
    AND confrelid = '"user"'::regclass
`);
console.log("FK constraints before:", before.map((r) => r.conname));

await sql.query(`
  DO $$
  DECLARE cname text;
  BEGIN
    SELECT conname INTO cname FROM pg_constraint
    WHERE conrelid = 'credit_ledger'::regclass AND contype = 'f'
      AND confrelid = '"user"'::regclass;
    IF cname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE credit_ledger DROP CONSTRAINT %I', cname);
    END IF;
  END $$;
`);

const after = await sql.query(`
  SELECT conname FROM pg_constraint
  WHERE conrelid = 'credit_ledger'::regclass AND contype = 'f'
    AND confrelid = '"user"'::regclass
`);
console.log("FK constraints after:", after.map((r) => r.conname));
console.log("Done.");
