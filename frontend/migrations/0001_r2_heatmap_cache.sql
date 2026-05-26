ALTER TABLE "heatmap_cache" ADD COLUMN "r2_key" text;
--> statement-breakpoint
ALTER TABLE "heatmap_cache" ADD COLUMN "last_accessed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "heatmap_cache" DROP COLUMN "heatmap_data";
