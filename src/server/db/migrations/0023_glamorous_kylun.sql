CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_preview` text NOT NULL,
	`created_by` text,
	`scopes` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_used_at` integer,
	`expires_at` integer NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_tokens_status_idx` ON `api_tokens` (`status`);--> statement-breakpoint
CREATE TABLE `settings_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text,
	`role` text,
	`module` text NOT NULL,
	`field` text NOT NULL,
	`before_value` text,
	`after_value` text,
	`change_type` text NOT NULL,
	`at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `settings_audit_logs_module_idx` ON `settings_audit_logs` (`module`);--> statement-breakpoint
CREATE INDEX `settings_audit_logs_at_idx` ON `settings_audit_logs` (`at`);