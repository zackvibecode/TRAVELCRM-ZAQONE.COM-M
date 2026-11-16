CREATE TABLE `packages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`destination` text NOT NULL,
	`duration_days` integer DEFAULT 0 NOT NULL,
	`description` text,
	`highlights` text DEFAULT '[]' NOT NULL,
	`itinerary` text DEFAULT '[]' NOT NULL,
	`inclusions` text DEFAULT '[]' NOT NULL,
	`exclusions` text DEFAULT '[]' NOT NULL,
	`adult_price` integer DEFAULT 0 NOT NULL,
	`child_price` integer DEFAULT 0 NOT NULL,
	`infant_price` integer DEFAULT 0 NOT NULL,
	`cover_image_url` text,
	`images` text DEFAULT '[]' NOT NULL,
	`pdf_url` text,
	`published` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `packages_destination_idx` ON `packages` (`destination`);--> statement-breakpoint
CREATE INDEX `packages_published_idx` ON `packages` (`published`);--> statement-breakpoint
CREATE INDEX `packages_archived_idx` ON `packages` (`archived`);