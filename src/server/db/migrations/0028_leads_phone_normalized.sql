-- WhatsApp Follow-Up CRM (Phase 6): normalized phone for duplicate detection.
-- Malaysian normalization: strip separators, then 60xxxxxxxxxx -> +60...,
-- 01xxxxxxxxx -> +601..., anything else keeps its digits with a leading +.
ALTER TABLE `leads` ADD `phone_normalized` text;--> statement-breakpoint
UPDATE `leads` SET `phone_normalized` = CASE
  WHEN d = '' THEN NULL
  WHEN d LIKE '60%' THEN '+' || d
  WHEN d LIKE '0%' THEN '+6' || d
  ELSE '+' || d
END
FROM (
  SELECT id,
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`phone`,
      ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '+', '') AS d
  FROM `leads`
) AS src
WHERE `leads`.`id` = src.id;--> statement-breakpoint
CREATE INDEX `leads_phone_normalized_idx` ON `leads` (`phone_normalized`);
