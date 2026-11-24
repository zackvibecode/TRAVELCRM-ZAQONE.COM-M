-- Phase 6 (WhatsApp Templates): make `code` the logical template key that
-- groups the EN and MS variants, instead of a globally unique row id.
-- The admin UI edits both locale bodies under one code, so the same code
-- must be allowed once per locale: UNIQUE (code, locale).
DROP INDEX IF EXISTS `whatsapp_templates_code_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_templates_code_locale_unique`
  ON `whatsapp_templates` (`code`, `locale`);--> statement-breakpoint
-- The picker filters by stage and active state per locale; this keeps that
-- query index-only.
CREATE INDEX `whatsapp_templates_stage_locale_active_idx`
  ON `whatsapp_templates` (`stage`, `locale`, `active`);--> statement-breakpoint
-- Seed the three follow-up stages with a bilingual template each. These
-- mirror MOCK_TEMPLATES on the frontend so the picker shows real rows
-- before the admin creates their own. OR IGNORE keeps this re-runnable.
INSERT OR IGNORE INTO `whatsapp_templates` (`id`, `code`, `name`, `locale`, `body`, `stage`, `active`) VALUES
  ('wt_fu1_en', 'fu1-intro', 'FU1 Introduction', 'en',
   'Hello {{leadName}}, this is {{salesName}} from ZAQ One Travel. You recently showed interest in the {{packageName}} package. May I share more details?',
   'FU1', 1),
  ('wt_fu1_ms', 'fu1-intro', 'FU1 Pengenalan', 'ms',
   'Salam {{leadName}}, saya {{salesName}} dari ZAQ One Travel. Anda baru berminat dengan pakej {{packageName}}. Boleh saya kongsikan butiran lanjut?',
   'FU1', 1),
  ('wt_fu2_en', 'fu2-reminder', 'FU2 Gentle Reminder', 'en',
   'Hi {{leadName}}, just a gentle reminder from {{salesName}} about the {{packageName}} package. Do you have any questions before deciding?',
   'FU2', 1),
  ('wt_fu2_ms', 'fu2-reminder', 'FU2 Peringatan Lembut', 'ms',
   'Hai {{leadName}}, ini peringatan mesra daripada {{salesName}} mengenai pakej {{packageName}}. Adakah anda ada sebarang soalan sebelum membuat keputusan?',
   'FU2', 1),
  ('wt_fu3_en', 'fu3-final', 'FU3 Final Follow-Up', 'en',
   'Hello {{leadName}}, this is my last follow-up regarding the {{packageName}} package. Let me know if you would still like to proceed.',
   'FU3', 1),
  ('wt_fu3_ms', 'fu3-final', 'FU3 Susulan Akhir', 'ms',
   'Helo {{leadName}}, ini susulan terakhir saya mengenai pakej {{packageName}}. Beritahu saya jika anda masih ingin meneruskan.',
   'FU3', 1);
