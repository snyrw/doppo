-- Make credit_ledger an immutable audit log that outlives the user row.
-- The FK to "user" was created inline in 0003 with a Postgres-auto-generated
-- name (e.g. credit_ledger_user_id_fkey), so drop it by discovery rather than
-- by a hardcoded name. After this, deleting a user no longer cascades away their
-- ledger history — deleteUserData() also writes an "account_closed" tombstone
-- row snapshotting the closing balance.
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'credit_ledger'::regclass
    AND contype = 'f'
    AND confrelid = 'user'::regclass;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE credit_ledger DROP CONSTRAINT %I', cname);
  END IF;
END $$;
