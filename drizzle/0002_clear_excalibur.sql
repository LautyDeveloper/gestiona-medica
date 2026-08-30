ALTER TABLE `persons` ADD `archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_persons_archived_name` ON `persons` (`archived`,`name`);