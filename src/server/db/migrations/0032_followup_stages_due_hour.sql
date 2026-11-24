-- Phase 6 (Admin Console): the follow-up schedule editor lets ADMIN set the
-- KL hour each stage becomes due (DEFAULT_SLOT_HOUR in followup-schedule-kl.ts
-- was a hard-coded 10). Persist it per stage so the engine honours the
-- console setting. Defaults keep the current behaviour (FU1 09:00, FU2/FU3
-- 10:00/11:00) for existing rows.
ALTER TABLE `followup_stages` ADD `due_hour_kl` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
-- Align the seed with the Admin Console preview (MOCK_STAGE_RULES): FU1 due
-- the same day at 09:00, FU2 two days later at 10:00, FU3 three days after
-- FU2 at 11:00. offset_days for FU1 is 0 (same day), matching the UI.
UPDATE `followup_stages` SET `offset_days` = 0, `due_hour_kl` = 9 WHERE `code` = 'FU1';--> statement-breakpoint
UPDATE `followup_stages` SET `offset_days` = 2, `due_hour_kl` = 10 WHERE `code` = 'FU2';--> statement-breakpoint
UPDATE `followup_stages` SET `offset_days` = 3, `due_hour_kl` = 11 WHERE `code` = 'FU3';
