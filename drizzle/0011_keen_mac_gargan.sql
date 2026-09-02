CREATE TABLE `medication_intakes` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`person_id` text NOT NULL,
	`scheduled_for` text,
	`reported_at` text NOT NULL,
	`status` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`recorded_by_user_id` text,
	`recorded_by_name` text NOT NULL,
	`created_at` text NOT NULL,
	`voided_at` text,
	`voided_by_user_id` text,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`voided_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "medication_intakes_status_check" CHECK("medication_intakes"."status" IN ('taken', 'not_taken'))
);
--> statement-breakpoint
CREATE INDEX `idx_medication_intakes_person_reported` ON `medication_intakes` (`person_id`,`reported_at`);--> statement-breakpoint
CREATE INDEX `idx_medication_intakes_medication_reported` ON `medication_intakes` (`medication_id`,`reported_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_medication_intakes_scheduled_active` ON `medication_intakes` (`medication_id`,`scheduled_for`) WHERE "medication_intakes"."scheduled_for" IS NOT NULL AND "medication_intakes"."voided_at" IS NULL;--> statement-breakpoint
CREATE TABLE `medication_schedule_times` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`local_time` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "medication_schedule_times_time_check" CHECK(length("medication_schedule_times"."local_time") = 5 AND substr("medication_schedule_times"."local_time", 1, 2) BETWEEN '00' AND '23' AND substr("medication_schedule_times"."local_time", 3, 1) = ':' AND substr("medication_schedule_times"."local_time", 4, 2) BETWEEN '00' AND '59'),
	CONSTRAINT "medication_schedule_times_position_check" CHECK("medication_schedule_times"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_medication_schedule_times_unique` ON `medication_schedule_times` (`medication_id`,`local_time`);--> statement-breakpoint
CREATE INDEX `idx_medication_schedule_times_medication` ON `medication_schedule_times` (`medication_id`);--> statement-breakpoint
CREATE TABLE `medication_stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`intake_id` text,
	`delta_milli` integer NOT NULL,
	`reason` text NOT NULL,
	`recorded_by_user_id` text,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`intake_id`) REFERENCES `medication_intakes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "medication_stock_movements_reason_check" CHECK("medication_stock_movements"."reason" IN ('initial', 'restock', 'intake', 'correction')),
	CONSTRAINT "medication_stock_movements_delta_check" CHECK("medication_stock_movements"."delta_milli" != 0)
);
--> statement-breakpoint
CREATE INDEX `idx_medication_stock_movements_medication` ON `medication_stock_movements` (`medication_id`,`recorded_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_medication_stock_movements_intake` ON `medication_stock_movements` (`intake_id`);--> statement-breakpoint
ALTER TABLE `alert_preferences` ADD `medication_lead_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `alert_preferences` ADD `medication_stock_enabled` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `medications` ADD `schedule_type` text DEFAULT 'unstructured' NOT NULL;--> statement-breakpoint
ALTER TABLE `medications` ADD `start_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `medications` ADD `end_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `medications` ADD `interval_minutes` integer;--> statement-breakpoint
ALTER TABLE `medications` ADD `interval_anchor_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `medications` ADD `presentation` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `medications` ADD `stock_unit` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `medications` ADD `units_per_intake_milli` integer;--> statement-breakpoint
ALTER TABLE `medications` ADD `stock_quantity_milli` integer;--> statement-breakpoint
ALTER TABLE `medications` ADD `reorder_threshold_milli` integer;--> statement-breakpoint
ALTER TABLE `medications` ADD `stock_cycle` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE TRIGGER medication_structure_insert
BEFORE INSERT ON medications
WHEN NEW.schedule_type NOT IN ('unstructured', 'fixed_times', 'interval', 'as_needed')
  OR (NEW.end_date <> '' AND NEW.start_date <> '' AND NEW.end_date < NEW.start_date)
  OR (NEW.interval_minutes IS NOT NULL AND NEW.interval_minutes <= 0)
  OR (NEW.units_per_intake_milli IS NOT NULL AND NEW.units_per_intake_milli <= 0)
  OR (NEW.reorder_threshold_milli IS NOT NULL AND NEW.reorder_threshold_milli < 0)
  OR NEW.stock_cycle <= 0
BEGIN SELECT RAISE(ABORT, 'invalid medication structure'); END;--> statement-breakpoint
CREATE TRIGGER medication_structure_update
BEFORE UPDATE OF schedule_type, start_date, end_date, interval_minutes,
  units_per_intake_milli, reorder_threshold_milli, stock_cycle ON medications
WHEN NEW.schedule_type NOT IN ('unstructured', 'fixed_times', 'interval', 'as_needed')
  OR (NEW.end_date <> '' AND NEW.start_date <> '' AND NEW.end_date < NEW.start_date)
  OR (NEW.interval_minutes IS NOT NULL AND NEW.interval_minutes <= 0)
  OR (NEW.units_per_intake_milli IS NOT NULL AND NEW.units_per_intake_milli <= 0)
  OR (NEW.reorder_threshold_milli IS NOT NULL AND NEW.reorder_threshold_milli < 0)
  OR NEW.stock_cycle <= 0
BEGIN SELECT RAISE(ABORT, 'invalid medication structure'); END;--> statement-breakpoint
CREATE TRIGGER alert_medication_preferences_insert
BEFORE INSERT ON alert_preferences
WHEN NEW.medication_lead_minutes NOT IN (-1, 0, 15, 30, 60)
  OR NEW.medication_stock_enabled NOT IN (0, 1)
BEGIN SELECT RAISE(ABORT, 'invalid medication alert preferences'); END;--> statement-breakpoint
CREATE TRIGGER alert_medication_preferences_update
BEFORE UPDATE OF medication_lead_minutes, medication_stock_enabled ON alert_preferences
WHEN NEW.medication_lead_minutes NOT IN (-1, 0, 15, 30, 60)
  OR NEW.medication_stock_enabled NOT IN (0, 1)
BEGIN SELECT RAISE(ABORT, 'invalid medication alert preferences'); END;--> statement-breakpoint
PRAGMA optimize;
