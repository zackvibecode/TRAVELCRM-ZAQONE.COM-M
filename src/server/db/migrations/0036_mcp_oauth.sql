-- MCP OAuth 2.1: dynamic clients, authorization codes (PKCE) and tokens.
CREATE TABLE `mcp_oauth_clients` (
  `id` text PRIMARY KEY NOT NULL,
  `client_id` text NOT NULL UNIQUE,
  `client_secret_hash` text,
  `name` text NOT NULL,
  `redirect_uris` text DEFAULT '[]' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_by` text,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `mcp_oauth_clients_client_idx` ON `mcp_oauth_clients` (`client_id`);
--> statement-breakpoint
CREATE TABLE `mcp_oauth_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `code_hash` text NOT NULL UNIQUE,
  `client_id` text NOT NULL,
  `user_id` text NOT NULL,
  `redirect_uri` text NOT NULL,
  `scope` text DEFAULT '' NOT NULL,
  `code_challenge` text,
  `code_challenge_method` text,
  `expires_at` text NOT NULL,
  `used_at` text,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `mcp_oauth_codes_client_idx` ON `mcp_oauth_codes` (`client_id`);
--> statement-breakpoint
CREATE TABLE `mcp_oauth_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text DEFAULT 'access' NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `client_id` text NOT NULL,
  `user_id` text NOT NULL,
  `scope` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `parent_id` text,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mcp_oauth_tokens_hash_idx` ON `mcp_oauth_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `mcp_oauth_tokens_user_client_idx` ON `mcp_oauth_tokens` (`user_id`,`client_id`);
