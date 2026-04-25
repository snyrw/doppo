"use server";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL environment variable. Set DATABASE_URL to your Neon connection string (from org-misty-smoke-22013610 / project summer-resonance-09986595) in .env.local or your deployment env."
  );
}

// single client instance for serverless usage
const sql = neon(process.env.DATABASE_URL);

// initialize a simple table (run once)
export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.examples (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;
}

// fetch recent rows
export async function getData() {
  const rows = await sql`SELECT id, name, created_at FROM public.examples ORDER BY created_at DESC LIMIT 100;`;
  return rows;
}

// insert a row
export async function insertExample(name: string) {
  const [row] = await sql`
    INSERT INTO public.examples (name) VALUES (${name})
    RETURNING id, name, created_at;
  `;
  return row;
}