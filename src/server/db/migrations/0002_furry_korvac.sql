CREATE TABLE `seat_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`departure_id` text NOT NULL,
	`booking_id` text,
	`seat_count` integer DEFAULT 1 NOT NULL,
	`held_by` text,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`released_at` text,
	FOREIGN KEY (`departure_id`) REFERENCES `departures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `seat_holds_departure_idx` ON `seat_holds` (`departure_id`);--> statement-breakpoint
CREATE INDEX `seat_holds_booking_idx` ON `seat_holds` (`booking_id`);--> statement-breakpoint
CREATE INDEX `seat_holds_status_idx` ON `seat_holds` (`status`);--> statement-breakpoint
CREATE INDEX `seat_holds_expires_idx` ON `seat_holds` (`expires_at`);