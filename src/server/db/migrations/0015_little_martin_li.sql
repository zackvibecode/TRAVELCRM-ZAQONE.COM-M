CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`quotation_item_id` text,
	`description` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `invoice_items_invoice_idx` ON `invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`booking_id` text,
	`quotation_id` text,
	`customer_id` text,
	`customer_name` text NOT NULL,
	`package_name` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`issue_date` text,
	`due_date` text,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`deposit_amount` integer DEFAULT 0 NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`balance_due` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`number`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `invoices_customer_idx` ON `invoices` (`customer_id`);--> statement-breakpoint
CREATE INDEX `invoices_booking_idx` ON `invoices` (`booking_id`);--> statement-breakpoint
CREATE INDEX `invoices_due_idx` ON `invoices` (`due_date`);--> statement-breakpoint
CREATE TABLE `payment_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`channel` text DEFAULT 'whatsapp' NOT NULL,
	`message` text NOT NULL,
	`sent_at` text DEFAULT (datetime('now')) NOT NULL,
	`sent_by` text
);
--> statement-breakpoint
CREATE INDEX `payment_reminders_invoice_idx` ON `payment_reminders` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text DEFAULT 'bank_transfer' NOT NULL,
	`status` text DEFAULT 'pending_verification' NOT NULL,
	`paid_at` text DEFAULT (datetime('now')) NOT NULL,
	`verified_by` text,
	`verified_at` text,
	`proof_key` text,
	`proof_uploaded` integer DEFAULT false NOT NULL,
	`reference` text,
	`notes` text,
	`created_by` text
);
--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text,
	`package_name` text,
	`destination` text,
	`pax_adult` integer DEFAULT 0 NOT NULL,
	`pax_child` integer DEFAULT 0 NOT NULL,
	`pax_infant` integer DEFAULT 0 NOT NULL,
	`departure_date` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`valid_until` text,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`lead_id` text,
	`created_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotations_number_unique` ON `quotations` (`number`);--> statement-breakpoint
CREATE INDEX `quotations_status_idx` ON `quotations` (`status`);--> statement-breakpoint
CREATE INDEX `quotations_lead_idx` ON `quotations` (`lead_id`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`invoice_id` text NOT NULL,
	`payment_id` text,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`requested_at` text DEFAULT (datetime('now')) NOT NULL,
	`processed_at` text,
	`processed_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refunds_number_unique` ON `refunds` (`number`);--> statement-breakpoint
CREATE INDEX `refunds_invoice_idx` ON `refunds` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `refunds_status_idx` ON `refunds` (`status`);