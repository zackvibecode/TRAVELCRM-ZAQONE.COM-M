CREATE TABLE `mcp_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text NOT NULL,
	`window_start` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mcp_rate_token_window_idx` ON `mcp_rate_limits` (`token_id`,`window_start`);