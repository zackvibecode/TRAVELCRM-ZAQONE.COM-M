-- Phase 6 (follow-up engine): add denormalised current-stage + pause /
-- escalation bookkeeping to `leads`. The existing followup_status /
-- followup_state enums are intentionally left untouched so the Phase 2
-- routes keep working; the current stage is derived from
-- followup_activities and cached here for fast per-stage querying.
ALTER TABLE `leads` ADD `followup_stage` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `followup_stage_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `paused_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `pause_reason` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `escalated_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `last_contacted_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `followup_completed_at` text;
--> statement-breakpoint
-- Backfill the current stage from confirmed activities: the highest stage
-- that has a confirmed activity is the one currently in progress.
UPDATE `leads` SET `followup_stage` = (
  SELECT MAX(`a`.`stage`)
  FROM `followup_activities` `a`
  WHERE `a`.`lead_id` = `leads`.`id` AND `a`.`confirmed` = 1
);
--> statement-breakpoint
-- Leads with no confirmed activity yet are at the first stage.
UPDATE `leads` SET `followup_stage` = 'FU1' WHERE `followup_stage` IS NULL;
--> statement-breakpoint
-- Leads already escalated by the engine carry the timestamp of that change.
UPDATE `leads` SET `escalated_at` = `updated_at`
WHERE `followup_state` = 'escalated' AND `escalated_at` IS NULL;
--> statement-breakpoint
UPDATE `leads` SET `paused_at` = `updated_at`
WHERE `followup_state` = 'paused' AND `paused_at` IS NULL;
--> statement-breakpoint
UPDATE `leads` SET `followup_completed_at` = `updated_at`
WHERE `followup_state` = 'done' AND `followup_completed_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `leads_followup_stage_idx` ON `leads` (`followup_stage`);--> statement-breakpoint
CREATE INDEX `leads_owner_stage_idx` ON `leads` (`owner_user_id`, `followup_stage`);--> statement-breakpoint
CREATE INDEX `leads_last_contacted_idx` ON `leads` (`last_contacted_at`);
