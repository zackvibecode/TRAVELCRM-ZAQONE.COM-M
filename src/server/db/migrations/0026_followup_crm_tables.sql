-- WhatsApp Follow-Up CRM (Phase 6): extend `leads` with ownership +
-- follow-up engine columns, and add the six new engine tables.
ALTER TABLE `leads` ADD `owner_user_id` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `followup_status` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `followup_state` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `next_followup_at` text;--> statement-breakpoint
CREATE INDEX `leads_owner_idx` ON `leads` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `leads_followup_state_idx` ON `leads` (`followup_state`);--> statement-breakpoint
CREATE INDEX `leads_next_followup_at_idx` ON `leads` (`next_followup_at`);--> statement-breakpoint
CREATE TABLE `followup_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name_ms` text NOT NULL,
	`name_en` text NOT NULL,
	`offset_days` integer DEFAULT 1 NOT NULL,
	`template_id` text,
	`order` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `followup_stages_code_unique` ON `followup_stages` (`code`);--> statement-breakpoint
CREATE INDEX `followup_stages_order_idx` ON `followup_stages` (`order`);--> statement-breakpoint
CREATE TABLE `followup_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`stage` text NOT NULL,
	`type` text NOT NULL,
	`text` text NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL,
	`user` text DEFAULT 'system' NOT NULL,
	`at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
CREATE INDEX `followup_activities_lead_idx` ON `followup_activities` (`lead_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `followup_activities_lead_stage_unique` ON `followup_activities` (`lead_id`,`stage`);--> statement-breakpoint
CREATE INDEX `followup_activities_at_idx` ON `followup_activities` (`at`);--> statement-breakpoint
CREATE TABLE `customer_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`text` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
CREATE INDEX `customer_notes_lead_idx` ON `customer_notes` (`lead_id`);--> statement-breakpoint
CREATE INDEX `customer_notes_created_idx` ON `customer_notes` (`created_at`);--> statement-breakpoint
CREATE TABLE `whatsapp_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`locale` text NOT NULL,
	`body` text NOT NULL,
	`stage` text,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_templates_code_unique` ON `whatsapp_templates` (`code`);--> statement-breakpoint
CREATE INDEX `whatsapp_templates_locale_idx` ON `whatsapp_templates` (`locale`);--> statement-breakpoint
CREATE INDEX `whatsapp_templates_stage_idx` ON `whatsapp_templates` (`stage`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`total_rows` integer DEFAULT 0 NOT NULL,
	`inserted_rows` integer DEFAULT 0 NOT NULL,
	`duplicate_rows` integer DEFAULT 0 NOT NULL,
	`failed_rows` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
CREATE INDEX `import_batches_created_idx` ON `import_batches` (`created_at`);--> statement-breakpoint
CREATE INDEX `import_batches_creator_idx` ON `import_batches` (`created_by`);--> statement-breakpoint
CREATE TABLE `import_errors` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`raw_data` text,
	`reason` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
CREATE INDEX `import_errors_batch_idx` ON `import_errors` (`batch_id`);--> statement-breakpoint
INSERT INTO `followup_stages` (`id`, `code`, `name_ms`, `name_en`, `offset_days`, `order`, `active`) VALUES
  ('fs_fu1', 'FU1', 'Susulan Pertama', 'First Follow-Up', 1, 1, 1),
  ('fs_fu2', 'FU2', 'Susulan Kedua', 'Second Follow-Up', 3, 2, 1),
  ('fs_fu3', 'FU3', 'Susulan Ketiga', 'Third Follow-Up', 7, 3, 1);
