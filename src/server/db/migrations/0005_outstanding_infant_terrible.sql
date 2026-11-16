CREATE TABLE `departure_costs` (
	`id` text PRIMARY KEY NOT NULL,
	`departure_id` text NOT NULL,
	`supplier_id` text,
	`category` text NOT NULL,
	`description` text,
	`estimated_amount` integer DEFAULT 0 NOT NULL,
	`actual_amount` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`departure_id`) REFERENCES `departures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `departure_costs_departure_idx` ON `departure_costs` (`departure_id`);--> statement-breakpoint
CREATE INDEX `departure_costs_supplier_idx` ON `departure_costs` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `supplier_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`departure_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'due' NOT NULL,
	`due_date` text,
	`paid_at` text,
	`reference` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`departure_id`) REFERENCES `departures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `supplier_payments_departure_idx` ON `supplier_payments` (`departure_id`);--> statement-breakpoint
CREATE INDEX `supplier_payments_supplier_idx` ON `supplier_payments` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `supplier_payments_status_idx` ON `supplier_payments` (`status`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`contact_name` text,
	`phone` text,
	`email` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `suppliers_type_idx` ON `suppliers` (`type`);