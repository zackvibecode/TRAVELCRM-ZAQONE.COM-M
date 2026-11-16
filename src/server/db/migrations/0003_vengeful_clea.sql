CREATE TABLE `passenger_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`passenger_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`passenger_id`) REFERENCES `passengers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passenger_documents_passenger_idx` ON `passenger_documents` (`passenger_id`);--> statement-breakpoint
CREATE INDEX `passenger_documents_type_idx` ON `passenger_documents` (`type`);--> statement-breakpoint
CREATE TABLE `trip_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`departure_id` text NOT NULL,
	`label` text NOT NULL,
	`category` text,
	`done` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`departure_id`) REFERENCES `departures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trip_checklist_departure_idx` ON `trip_checklist_items` (`departure_id`);