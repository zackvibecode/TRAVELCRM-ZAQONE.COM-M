CREATE TABLE `notification_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name_ms` text NOT NULL,
	`name_en` text NOT NULL,
	`channel` text NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_by` text,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_templates_code_unique` ON `notification_templates` (`code`);--> statement-breakpoint
CREATE INDEX `notification_templates_channel_idx` ON `notification_templates` (`channel`);--> statement-breakpoint
INSERT INTO notification_templates (`id`, `code`, `name_ms`, `name_en`, `channel`, `subject`, `body`, `enabled`, `updated_by`, `updatedAt`) VALUES
  ('nt_booking_confirm', 'booking_confirmation', 'Pengesahan Tempahan', 'Booking Confirmation', 'email', 'Tempahan anda disahkan — {{booking_ref}}', 'Assalamualaikum {{customer_name}},

Terima kasih. Tempahan anda untuk {{package_name}} ({{booking_ref}}) telah disahkan. Keberangkatan pada {{departure_date}}.

Terima kasih,
ZAQONE TRAVEL', 1, 'seed', strftime('%s','now')),
  ('nt_payment_reminder', 'payment_reminder', 'Peringatan Bayaran', 'Payment Reminder', 'whatsapp', 'Peringatan bayaran {{booking_ref}}', 'Hi {{customer_name}}, jangan lupa bayaran {{amount}} untuk {{booking_ref}} sebelum {{due_date}}. Terima kasih!', 1, 'seed', strftime('%s','now')),
  ('nt_departure_reminder', 'departure_reminder', 'Peringatan Keberangkatan', 'Departure Reminder', 'email', 'Keberangkatan anda dalam 3 hari', 'Assalamualaikum {{customer_name}},

Pakej {{package_name}} anda berlepas pada {{departure_date}}. Sila daftar masuk 3 jam awal.', 0, 'seed', strftime('%s','now'));
