CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid,
	"car_id" uuid,
	"client_id" uuid,
	"start_at" timestamp,
	"end_at" timestamp,
	"status" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "branches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "cars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid,
	"plate" text,
	"vin" text,
	"model" text,
	"starline_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"tg_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"system" text NOT NULL,
	"external_id" text NOT NULL,
	"branch_code" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_refs_system_external_unique" UNIQUE("system","external_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_dedup" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_dedup_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source" text NOT NULL,
	"dedup_hash" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_dedup_dedup_hash_unique" UNIQUE("dedup_hash")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_branch_idx" ON "bookings" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "bookings_car_idx" ON "bookings" USING btree ("car_id");--> statement-breakpoint
CREATE INDEX "bookings_client_idx" ON "bookings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "branches_code_idx" ON "branches" USING btree ("code");--> statement-breakpoint
CREATE INDEX "cars_branch_idx" ON "cars" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "cars_plate_idx" ON "cars" USING btree ("plate");--> statement-breakpoint
CREATE INDEX "external_refs_entity_idx" ON "external_refs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "external_refs_system_idx" ON "external_refs" USING btree ("system","external_id");--> statement-breakpoint
CREATE INDEX "webhook_dedup_hash_idx" ON "webhook_dedup" USING btree ("dedup_hash");--> statement-breakpoint
CREATE INDEX "webhook_dedup_source_idx" ON "webhook_dedup" USING btree ("source");--> statement-breakpoint
CREATE INDEX "webhook_dedup_received_idx" ON "webhook_dedup" USING btree ("received_at");