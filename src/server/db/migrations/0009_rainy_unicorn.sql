CREATE TABLE `package_itinerary_items` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`day_number` integer DEFAULT 1 NOT NULL,
	`title` text,
	`description` text,
	`meal_included` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `package_itinerary_package_idx` ON `package_itinerary_items` (`package_id`);--> statement-breakpoint
CREATE INDEX `package_itinerary_day_idx` ON `package_itinerary_items` (`day_number`);--> statement-breakpoint
CREATE TABLE `package_media` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`kind` text DEFAULT 'image' NOT NULL,
	`url` text NOT NULL,
	`alt` text,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `package_media_package_idx` ON `package_media` (`package_id`);--> statement-breakpoint
CREATE INDEX `package_media_kind_idx` ON `package_media` (`kind`);