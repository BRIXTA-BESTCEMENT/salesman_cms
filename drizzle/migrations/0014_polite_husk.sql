CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_role" varchar(100),
	"job_role" varchar(100),
	"granted_perms" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"perm_description" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_dashboard_user" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dashboard_login_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dashboard_hashed_password" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_sales_app_user" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;