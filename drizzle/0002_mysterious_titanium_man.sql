CREATE TABLE `student_email_verification_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`request_ip` text,
	`request_user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_email_verification_tokens_token_hash_unique` ON `student_email_verification_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `student_email_verification_tokens_student_idx` ON `student_email_verification_tokens` (`student_id`);--> statement-breakpoint
CREATE INDEX `student_email_verification_tokens_expires_at_idx` ON `student_email_verification_tokens` (`expires_at`);--> statement-breakpoint
ALTER TABLE `students` ADD `password_hash` text;