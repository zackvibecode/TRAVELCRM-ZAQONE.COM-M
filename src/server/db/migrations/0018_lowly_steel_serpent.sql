CREATE TABLE `mcp_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text,
	`tool` text NOT NULL,
	`arguments` text,
	`outcome` text NOT NULL,
	`denied_reason` text,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mcp_audit_token_idx` ON `mcp_audit_logs` (`token_id`);--> statement-breakpoint
CREATE INDEX `mcp_audit_tool_idx` ON `mcp_audit_logs` (`tool`);--> statement-breakpoint
CREATE INDEX `mcp_audit_created_idx` ON `mcp_audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `mcp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_preview` text NOT NULL,
	`role` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_used_at` text,
	`expires_at` text NOT NULL,
	`calls_last_30d` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_tokens_token_hash_unique` ON `mcp_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `mcp_tokens_hash_idx` ON `mcp_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `mcp_tokens_status_idx` ON `mcp_tokens` (`status`);