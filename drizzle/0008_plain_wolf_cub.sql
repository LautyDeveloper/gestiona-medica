CREATE TABLE `login_rate_limits` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`window_started_at` text NOT NULL,
	`blocked_until` text
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expiration` ON `sessions` (`expires_at`);