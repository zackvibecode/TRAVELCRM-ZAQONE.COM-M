-- AI Workers: background automation runs (package enrichment, supplier PDF
-- sync, price & margin checks). Each run records what the worker did so the
-- AI Workers page can display results, diffs and history.
CREATE TABLE `ai_worker_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `worker` text NOT NULL,
  `status` text NOT NULL,
  `summary` text DEFAULT '' NOT NULL,
  `result` text,
  `package_id` text,
  `staff_id` text,
  `applied_at` text,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `ai_worker_runs_worker_created_idx` ON `ai_worker_runs` (`worker`,`created_at`);
--> statement-breakpoint
CREATE INDEX `ai_worker_runs_status_idx` ON `ai_worker_runs` (`status`);
