DROP INDEX `packages_published_idx`;--> statement-breakpoint
DROP INDEX `packages_archived_idx`;--> statement-breakpoint
ALTER TABLE `packages` ADD `publish_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
CREATE INDEX `packages_publish_status_idx` ON `packages` (`publish_status`);