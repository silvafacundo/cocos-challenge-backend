-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
CREATE TABLE "instruments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" varchar(10),
	"name" varchar(255),
	"type" varchar(10)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"instrumentid" integer,
	"userid" integer,
	"size" integer,
	"price" numeric(10, 2),
	"type" varchar(10),
	"side" varchar(10),
	"status" varchar(20),
	"datetime" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255),
	"accountnumber" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "marketdata" (
	"id" serial PRIMARY KEY NOT NULL,
	"instrumentid" integer,
	"high" numeric(10, 2),
	"low" numeric(10, 2),
	"open" numeric(10, 2),
	"close" numeric(10, 2),
	"previousclose" numeric(10, 2),
	"date" date
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_instrumentid_fkey" FOREIGN KEY ("instrumentid") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_userid_fkey" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketdata" ADD CONSTRAINT "marketdata_instrumentid_fkey" FOREIGN KEY ("instrumentid") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;