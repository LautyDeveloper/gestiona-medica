CREATE TABLE `medical_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`specialty` text NOT NULL,
	`reason` text NOT NULL,
	`requested_by` text NOT NULL,
	`issue_date` text NOT NULL,
	`expiration_date` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`appointment_id` text,
	`used_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_medical_orders_person_status_expiration` ON `medical_orders` (`person_id`,`status`,`expiration_date`);--> statement-breakpoint
CREATE TABLE `prescriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`medication_name` text NOT NULL,
	`presentation` text NOT NULL,
	`dose` text NOT NULL,
	`frequency` text NOT NULL,
	`duration` text NOT NULL,
	`prescribed_by` text NOT NULL,
	`issue_date` text NOT NULL,
	`expiration_date` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`medication_id` text,
	`used_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_prescriptions_person_status_expiration` ON `prescriptions` (`person_id`,`status`,`expiration_date`);--> statement-breakpoint
DROP INDEX `idx_users_username_nocase`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_username_nocase` ON `users` ("username" COLLATE NOCASE);