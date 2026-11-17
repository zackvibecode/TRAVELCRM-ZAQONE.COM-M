CREATE TABLE `staff_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`ip` text,
	`user_agent` text,
	`outcome` text DEFAULT 'success' NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_audit_logs_user_idx` ON `staff_audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `staff_audit_logs_action_idx` ON `staff_audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `staff_audit_logs_created_at_idx` ON `staff_audit_logs` (`createdAt`);