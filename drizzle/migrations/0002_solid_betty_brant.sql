DROP TABLE "_prisma_migrations" CASCADE;--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "zone" varchar(255);--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "area" varchar(255);