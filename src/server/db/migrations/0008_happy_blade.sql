CREATE TABLE `package_pricing` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`label` text NOT NULL,
	`pricing_type` text DEFAULT 'per_person' NOT NULL,
	`adult_price` integer DEFAULT 0 NOT NULL,
	`child_price` integer DEFAULT 0 NOT NULL,
	`infant_price` integer DEFAULT 0 NOT NULL,
	`valid_from` text,
	`valid_to` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `package_pricing_package_idx` ON `package_pricing` (`package_id`);--> statement-breakpoint
CREATE INDEX `package_pricing_type_idx` ON `package_pricing` (`pricing_type`);--> statement-breakpoint
CREATE INDEX `package_pricing_default_idx` ON `package_pricing` (`is_default`);