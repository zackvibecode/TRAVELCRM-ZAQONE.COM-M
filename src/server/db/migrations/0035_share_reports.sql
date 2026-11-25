-- Share Report: entries submitted by sales themselves (customer, packs, source).
CREATE TABLE `share_reports` (
  `id` text PRIMARY KEY NOT NULL,
  `month` text NOT NULL,
  `user_id` text NOT NULL,
  `customer_name` text NOT NULL,
  `packs` integer DEFAULT 1 NOT NULL,
  `source` text DEFAULT '' NOT NULL,
  `notes` text,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `share_reports_month_idx` ON `share_reports` (`month`);
--> statement-breakpoint
CREATE INDEX `share_reports_user_month_idx` ON `share_reports` (`user_id`,`month`);
