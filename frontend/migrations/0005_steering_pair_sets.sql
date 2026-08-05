CREATE TABLE IF NOT EXISTS "steering_pair_sets" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "clean_prompt" text NOT NULL,
  "corrupted_prompt" text NOT NULL,
  "extra_pairs" jsonb NOT NULL DEFAULT '[]',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "steering_pair_sets_user_idx" ON "steering_pair_sets" ("user_id");