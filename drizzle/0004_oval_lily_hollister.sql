CREATE INDEX `attempts_created_at_idx` ON `attempts` (`created_at`);--> statement-breakpoint
CREATE INDEX `attempts_student_started_lookup_idx` ON `attempts` (`student_id`,`mode`,`status`,`created_at`,`attempt_no`);--> statement-breakpoint
CREATE INDEX `attempts_student_started_article_lookup_idx` ON `attempts` (`student_id`,`mode`,`status`,`article_id`,`created_at`,`attempt_no`);--> statement-breakpoint
CREATE INDEX `attempts_student_snapshot_lookup_idx` ON `attempts` (`student_no_snapshot`,`attempt_no`,`created_at`);--> statement-breakpoint
CREATE INDEX `attempts_leaderboard_idx` ON `attempts` (`mode`,`status`,"score_kpm" desc,"accuracy" desc,`submitted_at`);--> statement-breakpoint
CREATE INDEX `auth_login_attempts_created_at_idx` ON `auth_login_attempts` (`created_at`);--> statement-breakpoint
CREATE INDEX `student_email_verification_tokens_request_ip_created_at_idx` ON `student_email_verification_tokens` (`request_ip`,`created_at`);