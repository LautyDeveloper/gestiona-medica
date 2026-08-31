DELETE FROM `sessions`
WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `user_type` = 'elder');
--> statement-breakpoint
DELETE FROM `memberships`
WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `user_type` = 'elder');
--> statement-breakpoint
DELETE FROM `users` WHERE `user_type` = 'elder';
