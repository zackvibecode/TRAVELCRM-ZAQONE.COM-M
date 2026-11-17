CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` text,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`bank_name` text NOT NULL,
	`account_no` text NOT NULL,
	`holder` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_by` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `numbering_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`doc` text NOT NULL,
	`prefix` text NOT NULL,
	`digits` integer DEFAULT 6 NOT NULL,
	`next_no` integer DEFAULT 1 NOT NULL,
	`reset_on` text DEFAULT 'year' NOT NULL,
	`last_reset_at` integer,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `numbering_rules_doc_unique` ON `numbering_rules` (`doc`);--> statement-breakpoint
INSERT INTO app_settings (`key`, `value`, `updated_by`, `updatedAt`) VALUES
  ('general', '{"defaultLang":"ms","currency":"MYR","timezone":"Asia/Kuala_Lumpur","seatsThreshold":20}', 'seed', strftime('%s','now')),
  ('company', '{"name":"ZAQONE TRAVEL & TOURS","registrationNo":"SA0123456789-KLM","licenseNo":"KPL/LN/000012345","licenseExpiry":"2028-06-30","phone":"+60 3-2168 8888","email":"hello@zaqone.travel","website":"https://zaqone.travel","address":"Lot 12, Jalan Sultan Ismail, 50250 Kuala Lumpur","city":"Kuala Lumpur","state":"Wilayah Persekutuan","postcode":"50250","country":"Malaysia","taxId":"MY-TIN-2026-001"}', 'seed', strftime('%s','now')),
  ('notifications', '{"lowSeats":true,"overdue":true,"departure":true,"newLead":false}', 'seed', strftime('%s','now')),
  ('terms', '{"defaultDepositPercent":30,"fullPaymentDaysBefore":14,"draftHoldMinutes":60,"paymentMethods":["bank_transfer","credit_card","cash","e_wallet"],"termsText":"Deposit 30% upon confirmation. Full payment 14 days before departure. Prices in MYR.","checkInHours":3,"minPax":2}', 'seed', strftime('%s','now')),
  ('security', '{"require2faSuperAdmin":true,"lockAfterAttempts":5,"idleTimeoutMinutes":30}', 'seed', strftime('%s','now'));
--> statement-breakpoint
INSERT INTO bank_accounts (`id`, `bank_name`, `account_no`, `holder`, `is_default`, `created_by`, `createdAt`) VALUES
  ('ba_seed_01', 'Maybank Islamic Berhad', '1234 5678 9012', 'ZAQONE TRAVEL & TOURS SDN BHD', 1, 'seed', strftime('%s','now')),
  ('ba_seed_02', 'CIMB Bank Berhad', '8001 2345 6789', 'ZAQONE TRAVEL & TOURS SDN BHD', 0, 'seed', strftime('%s','now'));
--> statement-breakpoint
INSERT INTO numbering_rules (`id`, `doc`, `prefix`, `digits`, `next_no`, `reset_on`, `updatedAt`) VALUES
  ('nr_seed_booking', 'booking', 'ZQK', 6, 1, 'year', strftime('%s','now')),
  ('nr_seed_invoice', 'invoice', 'INV', 6, 1, 'year', strftime('%s','now')),
  ('nr_seed_receipt', 'receipt', 'RCT', 6, 1, 'year', strftime('%s','now')),
  ('nr_seed_quote', 'quote', 'QTN', 5, 1, 'month', strftime('%s','now')),
  ('nr_seed_credit_note', 'credit_note', 'CN', 5, 1, 'never', strftime('%s','now'));
