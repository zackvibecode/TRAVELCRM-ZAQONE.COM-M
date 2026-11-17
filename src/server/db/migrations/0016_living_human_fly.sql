CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alerts_kind_idx` ON `alerts` (`kind`);--> statement-breakpoint
CREATE INDEX `alerts_entity_idx` ON `alerts` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `alerts_read_idx` ON `alerts` (`is_read`);--> statement-breakpoint
CREATE TABLE `site_banners` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`cta_label` text DEFAULT '' NOT NULL,
	`cta_href` text DEFAULT '/site/packages' NOT NULL,
	`start_at` text,
	`end_at` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_banners_active_idx` ON `site_banners` (`active`);--> statement-breakpoint
CREATE TABLE `site_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_pages_slug_unique` ON `site_pages` (`slug`);--> statement-breakpoint
CREATE INDEX `site_pages_status_idx` ON `site_pages` (`status`);--> statement-breakpoint
CREATE TABLE `site_seo` (
	`slug` text PRIMARY KEY NOT NULL,
	`meta_title` text DEFAULT '' NOT NULL,
	`meta_description` text DEFAULT '' NOT NULL,
	`keywords` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
