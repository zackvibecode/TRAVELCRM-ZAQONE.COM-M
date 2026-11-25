-- Sales Report: monthly targets ("Team Mission"). user_id NULL = team-wide.
CREATE TABLE `sales_targets` (
  `id` text PRIMARY KEY NOT NULL,
  `month` text NOT NULL,
  `user_id` text,
  `metric` text NOT NULL,
  `target_value` integer DEFAULT 0 NOT NULL,
  `created_by` text,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `sales_targets_month_idx` ON `sales_targets` (`month`);
--> statement-breakpoint
CREATE INDEX `sales_targets_user_month_idx` ON `sales_targets` (`user_id`,`month`);
