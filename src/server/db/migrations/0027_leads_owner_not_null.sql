-- Make leads.owner_user_id mandatory (NOT NULL) with backfill:
-- owner := existing owner_user_id, else assigned_to, else first super_admin.
CREATE TABLE `leads_new` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`destination` text,
	`pax` integer DEFAULT 1 NOT NULL,
	`budget` integer DEFAULT 0 NOT NULL,
	`stage` text DEFAULT 'new' NOT NULL,
	`source_id` text,
	`assigned_to` text,
	`next_follow_up` text,
	`last_activity_at` text DEFAULT (datetime('now')) NOT NULL,
	`notes` text,
	`customer_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`owner_user_id` text NOT NULL,
	`followup_status` text,
	`followup_state` text,
	`next_followup_at` text
);
--> statement-breakpoint
INSERT INTO `leads_new` (`id`, `name`, `phone`, `email`, `destination`, `pax`, `budget`, `stage`, `source_id`, `assigned_to`, `next_follow_up`, `last_activity_at`, `notes`, `customer_id`, `created_at`, `updated_at`, `owner_user_id`, `followup_status`, `followup_state`, `next_followup_at`)
SELECT
	`id`, `name`, `phone`, `email`, `destination`, `pax`, `budget`, `stage`, `source_id`, `assigned_to`, `next_follow_up`, `last_activity_at`, `notes`, `customer_id`, `created_at`, `updated_at`,
	COALESCE(
		`owner_user_id`,
		`assigned_to`,
		(SELECT `id` FROM `user` WHERE `role` = 'super_admin' ORDER BY `id` LIMIT 1)
	) AS `owner_user_id`,
	`followup_status`,
	`followup_state`,
	`next_followup_at`
FROM `leads`;
--> statement-breakpoint
DROP TABLE `leads`;
--> statement-breakpoint
ALTER TABLE `leads_new` RENAME TO `leads`;
--> statement-breakpoint
CREATE INDEX `leads_stage_idx` ON `leads` (`stage`);
--> statement-breakpoint
CREATE INDEX `leads_source_idx` ON `leads` (`source_id`);
--> statement-breakpoint
CREATE INDEX `leads_assigned_idx` ON `leads` (`assigned_to`);
--> statement-breakpoint
CREATE INDEX `leads_next_follow_up_idx` ON `leads` (`next_follow_up`);
--> statement-breakpoint
CREATE INDEX `leads_owner_idx` ON `leads` (`owner_user_id`);
--> statement-breakpoint
CREATE INDEX `leads_followup_state_idx` ON `leads` (`followup_state`);
--> statement-breakpoint
CREATE INDEX `leads_next_followup_at_idx` ON `leads` (`next_followup_at`);
