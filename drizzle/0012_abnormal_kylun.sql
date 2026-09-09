CREATE TABLE `medical_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`doctor` text NOT NULL,
	`date` text NOT NULL,
	`content` text NOT NULL,
	`appointment_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "medical_feedback_version_check" CHECK("medical_feedback"."version" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_medical_feedback_person_date` ON `medical_feedback` (`person_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_medical_feedback_appointment` ON `medical_feedback` (`appointment_id`);
