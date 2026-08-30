CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`specialty` text NOT NULL,
	`doctor` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`place` text NOT NULL,
	`bring` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Próximo' NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_appointments_person_date` ON `appointments` (`person_id`,`date`);--> statement-breakpoint
CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`name` text NOT NULL,
	`dose` text NOT NULL,
	`frequency` text NOT NULL,
	`doctor` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_medications_person_active` ON `medications` (`person_id`,`active`);--> statement-breakpoint
CREATE TABLE `persons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`status` text DEFAULT 'Pendiente' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_person_status_date` ON `tasks` (`person_id`,`status`,`due_date`);