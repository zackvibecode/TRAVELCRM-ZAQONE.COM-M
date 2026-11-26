-- Import groups ("kumpulan fail"): a named bucket a sales rep files each
-- Excel upload into, so the Follow-Up Engine can be filtered by it.
-- One group -> many import_batches (files) -> many leads. Leads keep their
-- owner_user_id (the rep who uploaded), so nothing changes about ownership.
CREATE TABLE `import_groups` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `owner_user_id` text NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
CREATE INDEX `import_groups_owner_idx` ON `import_groups` (`owner_user_id`);--> statement-breakpoint
ALTER TABLE `import_batches` ADD `group_id` text;--> statement-breakpoint
CREATE INDEX `import_batches_group_idx` ON `import_batches` (`group_id`);--> statement-breakpoint
ALTER TABLE `leads` ADD `batch_id` text;--> statement-breakpoint
CREATE INDEX `leads_batch_idx` ON `leads` (`batch_id`);
