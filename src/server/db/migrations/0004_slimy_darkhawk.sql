CREATE TABLE `rooming_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`departure_id` text NOT NULL,
	`room_number` text NOT NULL,
	`room_type` text,
	`hotel_name` text,
	`passenger_ids` text DEFAULT '[]' NOT NULL,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`departure_id`) REFERENCES `departures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rooming_departure_idx` ON `rooming_assignments` (`departure_id`);--> statement-breakpoint
CREATE TABLE `trip_flights` (
	`id` text PRIMARY KEY NOT NULL,
	`departure_id` text NOT NULL,
	`kind` text DEFAULT 'flight' NOT NULL,
	`code` text,
	`airline` text,
	`origin` text,
	`destination` text,
	`depart_at` text,
	`arrive_at` text,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`departure_id`) REFERENCES `departures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trip_flights_departure_idx` ON `trip_flights` (`departure_id`);