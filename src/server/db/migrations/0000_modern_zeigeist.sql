CREATE TABLE `booking_history` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`user` text,
	`at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `booking_history_booking_idx` ON `booking_history` (`booking_id`);--> statement-breakpoint
CREATE INDEX `booking_history_at_idx` ON `booking_history` (`at`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`customer_id` text NOT NULL,
	`package_id` text NOT NULL,
	`departure_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`pax_adult` integer DEFAULT 0 NOT NULL,
	`pax_child` integer DEFAULT 0 NOT NULL,
	`pax_infant` integer DEFAULT 0 NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`deposit_amount` integer DEFAULT 0 NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`balance_due` integer DEFAULT 0 NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_reference_unique` ON `bookings` (`reference`);--> statement-breakpoint
CREATE INDEX `bookings_status_idx` ON `bookings` (`status`);--> statement-breakpoint
CREATE INDEX `bookings_payment_status_idx` ON `bookings` (`payment_status`);--> statement-breakpoint
CREATE INDEX `bookings_departure_idx` ON `bookings` (`departure_id`);--> statement-breakpoint
CREATE TABLE `passengers` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`full_name` text NOT NULL,
	`type` text NOT NULL,
	`date_of_birth` text,
	`gender` text,
	`nationality` text,
	`passport_number` text,
	`passport_expiry` text,
	`phone` text,
	`room_type` text,
	`rooming_note` text,
	`dietary_note` text,
	`flight_info` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passengers_booking_idx` ON `passengers` (`booking_id`);--> statement-breakpoint
CREATE INDEX `passengers_passport_idx` ON `passengers` (`passport_number`);