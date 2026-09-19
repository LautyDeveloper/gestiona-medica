CREATE TABLE `push_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`alert_key` text NOT NULL,
	`phase` text NOT NULL,
	`status` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`attempted_at` text NOT NULL,
	`delivered_at` text,
	FOREIGN KEY (`subscription_id`) REFERENCES `push_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "push_deliveries_status_check" CHECK("push_deliveries"."status" IN ('claimed', 'sent', 'skipped'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_push_deliveries_once` ON `push_deliveries` (`subscription_id`,`alert_key`,`phase`);--> statement-breakpoint
CREATE INDEX `idx_push_deliveries_status_scheduled` ON `push_deliveries` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_success_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_push_subscriptions_endpoint` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_user` ON `push_subscriptions` (`user_id`);