DROP TABLE `care_group_invitations`;--> statement-breakpoint
DROP TABLE `memberships`;--> statement-breakpoint
UPDATE `persons`
SET `care_group_id` = (
	SELECT `id` FROM `care_groups` ORDER BY `created_at`, `id` LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM `care_groups`);--> statement-breakpoint
DELETE FROM `care_groups`
WHERE `id` <> (
	SELECT `id` FROM `care_groups` ORDER BY `created_at`, `id` LIMIT 1
);--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`user_type` text NOT NULL CHECK (`user_type` IN ('caregiver', 'elder')),
	`failed_login_count` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_username_nocase`
ON `users` (`username` COLLATE NOCASE);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`care_group_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL CHECK (`role` IN ('admin', 'member')),
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`care_group_id`) REFERENCES `care_groups`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_memberships_group_user`
ON `memberships` (`care_group_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_memberships_user` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
PRAGMA optimize;
