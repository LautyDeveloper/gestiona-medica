CREATE TABLE `alert_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`appointment_lead_minutes` integer DEFAULT 1440 NOT NULL,
	`task_lead_days` integer DEFAULT 0 NOT NULL,
	`document_lead_days` integer DEFAULT 7 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "alert_preferences_appointment_lead_check" CHECK("alert_preferences"."appointment_lead_minutes" IN (-1, 1440, 2880, 10080)),
	CONSTRAINT "alert_preferences_task_lead_check" CHECK("alert_preferences"."task_lead_days" IN (-1, 0, 1, 3)),
	CONSTRAINT "alert_preferences_document_lead_check" CHECK("alert_preferences"."document_lead_days" IN (-1, 3, 7, 14))
);
--> statement-breakpoint
CREATE TABLE `alert_states` (
	`user_id` text NOT NULL,
	`alert_key` text NOT NULL,
	`read_at` text,
	`snoozed_until` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `alert_key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_alert_states_user_updated` ON `alert_states` (`user_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `visible_to_elder` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TRIGGER `tasks_elder_visibility_insert`
BEFORE INSERT ON `tasks`
WHEN NEW.`visible_to_elder` NOT IN (0, 1)
BEGIN
  SELECT RAISE(ABORT, 'tasks elder visibility constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `tasks_elder_visibility_update`
BEFORE UPDATE OF `visible_to_elder` ON `tasks`
WHEN NEW.`visible_to_elder` NOT IN (0, 1)
BEGIN
  SELECT RAISE(ABORT, 'tasks elder visibility constraint failed');
END;--> statement-breakpoint
PRAGMA optimize;
