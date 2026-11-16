CREATE TABLE `package_departure_dates` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`departure_date` text NOT NULL,
	`return_date` text,
	`seat_capacity` integer DEFAULT 0 NOT NULL,
	`adult_price` integer DEFAULT 0 NOT NULL,
	`child_price` integer DEFAULT 0 NOT NULL,
	`infant_price` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `package_departure_dates_package_idx` ON `package_departure_dates` (`package_id`);--> statement-breakpoint
CREATE INDEX `package_departure_dates_date_idx` ON `package_departure_dates` (`departure_date`);--> statement-breakpoint
CREATE INDEX `package_departure_dates_status_idx` ON `package_departure_dates` (`status`);