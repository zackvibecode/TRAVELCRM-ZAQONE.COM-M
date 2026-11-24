-- Phase 6 (Dashboard & Ranking): covering indexes for the dashboard query
-- patterns. The leaderboard / trend endpoints aggregate confirmed
-- follow-ups inside a date window per sales rep, and the pipeline cards
-- count a rep's leads by engine state + schedule. Without these, every
-- dashboard load scanned the whole activities table (confirmed + at range)
-- and the whole leads table (owner + state).
--> statement-breakpoint
-- Leaderboard + daily trend: confirmed follow-ups within [from, to).
CREATE INDEX `followup_activities_confirmed_at_idx`
  ON `followup_activities` (`confirmed`, `at`);--> statement-breakpoint
-- Per-rep slice of the same window (GROUP BY user / COUNT(DISTINCT …)).
CREATE INDEX `followup_activities_user_confirmed_at_idx`
  ON `followup_activities` (`user`, `confirmed`, `at`);--> statement-breakpoint
-- My Pipeline: leads per owner by state, plus due-today / overdue ranges
-- read from next_followup_at inside the same owner+state partition.
CREATE INDEX `leads_owner_state_next_idx`
  ON `leads` (`owner_user_id`, `followup_state`, `next_followup_at`);--> statement-breakpoint
-- "Won within period": dashboard outcome counts filtered by completion date.
CREATE INDEX `leads_followup_completed_at_idx`
  ON `leads` (`followup_completed_at`);
