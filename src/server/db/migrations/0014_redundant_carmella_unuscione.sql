CREATE TABLE `lead_follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`due_at` text NOT NULL,
	`channel` text DEFAULT 'whatsapp' NOT NULL,
	`note` text,
	`done` integer DEFAULT false NOT NULL,
	`done_at` text,
	`done_by` text,
	`created_by` text DEFAULT 'system' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lead_follow_ups_lead_idx` ON `lead_follow_ups` (`lead_id`);--> statement-breakpoint
CREATE INDEX `lead_follow_ups_due_idx` ON `lead_follow_ups` (`due_at`);--> statement-breakpoint
CREATE INDEX `lead_follow_ups_done_idx` ON `lead_follow_ups` (`done`);