CREATE TABLE `care_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_subject` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_auth_subject_unique` ON `users` (`auth_subject`);--> statement-breakpoint
CREATE TABLE `care_group_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`care_group_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`responded_by_user_id` text,
	`responded_at` text,
	FOREIGN KEY (`care_group_id`) REFERENCES `care_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`responded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `care_group_invitations_token_hash_unique` ON `care_group_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_invitations_group_status` ON `care_group_invitations` (`care_group_id`,`status`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`care_group_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`care_group_id`) REFERENCES `care_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_memberships_group_user` ON `memberships` (`care_group_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_memberships_user` ON `memberships` (`user_id`);--> statement-breakpoint
INSERT INTO `care_groups` (`id`, `name`, `created_at`)
SELECT '00000000-0000-4000-8000-000000000003', 'Grupo familiar', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM `persons`);--> statement-breakpoint
DROP INDEX `idx_persons_archived_name`;--> statement-breakpoint
ALTER TABLE `persons` ADD `care_group_id` text DEFAULT '00000000-0000-4000-8000-000000000003' NOT NULL;--> statement-breakpoint
ALTER TABLE `persons` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE TRIGGER `persons_care_group_insert` BEFORE INSERT ON `persons`
WHEN NOT EXISTS (SELECT 1 FROM `care_groups` WHERE `id` = NEW.`care_group_id`)
BEGIN SELECT RAISE(ABORT, 'care group does not exist'); END;--> statement-breakpoint
CREATE TRIGGER `persons_care_group_update` BEFORE UPDATE OF `care_group_id` ON `persons`
WHEN NOT EXISTS (SELECT 1 FROM `care_groups` WHERE `id` = NEW.`care_group_id`)
BEGIN SELECT RAISE(ABORT, 'care group does not exist'); END;--> statement-breakpoint
CREATE INDEX `idx_persons_group_archived_name` ON `persons` (`care_group_id`,`archived`,`name`);--> statement-breakpoint
ALTER TABLE `appointments` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `medications` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `version` integer DEFAULT 1 NOT NULL;
