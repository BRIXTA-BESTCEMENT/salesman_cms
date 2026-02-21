CREATE TABLE "tso_assignments" (
	"tso_id" integer NOT NULL,
	"mason_id" uuid NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tso_assignments_tso_id_mason_id_pk" PRIMARY KEY("tso_id","mason_id")
);
--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "diffGrossWtInvoiceDt" varchar(100);--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "diffInvoiceDtGateOut" varchar(100);--> statement-breakpoint
ALTER TABLE "tso_assignments" ADD CONSTRAINT "tso_assignments_tso_id_users_id_fk" FOREIGN KEY ("tso_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tso_assignments" ADD CONSTRAINT "tso_assignments_mason_id_mason_pc_side_id_fk" FOREIGN KEY ("mason_id") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tso_assignments_tso_id" ON "tso_assignments" USING btree ("tso_id");--> statement-breakpoint
ALTER TABLE "logistics_io" DROP COLUMN "diffGrossWtInvoiceDT";--> statement-breakpoint
ALTER TABLE "logistics_io" DROP COLUMN "diffInvoiceDTGateOut";