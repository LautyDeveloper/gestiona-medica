ALTER TABLE `persons` ADD `birth_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `persons` ADD `relationship` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `persons` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
DELETE FROM `appointments` WHERE `person_id` = 'person-elena';--> statement-breakpoint
DELETE FROM `medications` WHERE `person_id` = 'person-elena';--> statement-breakpoint
DELETE FROM `tasks` WHERE `person_id` = 'person-elena';--> statement-breakpoint
DELETE FROM `persons` WHERE `id` = 'person-elena';
