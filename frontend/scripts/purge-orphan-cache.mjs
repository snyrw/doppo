// frontend/scripts/purge-orphan-cache.mjs
import { neon } from "@neondatabase/serverless";
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
const BUCKET = process.env.R2_BUCKET_NAME;
const tables = ["heatmap_cache", "dla_cache", "attribution_cache", "steering_cache", "activation_patch_cache", "attn_cache"];

for (const t of tables) {
  const { rows } = await sql.query(`SELECT id FROM ${t} WHERE user_id IS NULL`);
  const keys = rows.map((r) => r.id);
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    if (batch.length) await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: batch.map((Key) => ({ Key })) } }));
  }
  await sql.query(`DELETE FROM ${t} WHERE user_id IS NULL`);
  console.log(`purged ${keys.length} orphan rows from ${t}`);
}
console.log("done");
