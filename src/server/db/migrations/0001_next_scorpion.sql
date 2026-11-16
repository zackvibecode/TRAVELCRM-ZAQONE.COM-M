CREATE TABLE `departures` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`departure_date` text NOT NULL,
	`return_date` text,
	`seat_capacity` integer DEFAULT 0 NOT NULL,
	`seats_booked` integer DEFAULT 0 NOT NULL,
	`seats_held` integer DEFAULT 0 NOT NULL,
	`adult_price` integer DEFAULT 0 NOT NULL,
	`child_price` integer DEFAULT 0 NOT NULL,
	`infant_price` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`tour_leader` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `departures_package_idx` ON `departures` (`package_id`);--> statement-breakpoint
CREATE INDEX `departures_status_idx` ON `departures` (`status`);