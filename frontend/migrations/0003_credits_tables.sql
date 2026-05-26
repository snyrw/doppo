CREATE TABLE IF NOT EXISTS "user_credits" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "balance_micros" bigint NOT NULL DEFAULT 0,
  "last_free_grant_month" text
);

CREATE TABLE IF NOT EXISTS "credit_ledger" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "amount_micros" bigint NOT NULL,
  "job_tier" text,
  "job_duration_ms" integer,
  "stripe_checkout_session_id" text,
  CONSTRAINT "credit_ledger_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);
