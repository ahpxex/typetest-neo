CREATE TABLE `admin_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_username_unique` ON `admin_users` (`username`);--> statement-breakpoint
CREATE INDEX `admin_users_status_idx` ON `admin_users` (`status`);--> statement-breakpoint
CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`content_raw` text NOT NULL,
	`content_normalized` text NOT NULL,
	`char_count` integer DEFAULT 0 NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`difficulty_level` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE INDEX `articles_language_status_idx` ON `articles` (`language`,`status`);--> statement-breakpoint
CREATE INDEX `articles_title_idx` ON `articles` (`title`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`article_id` integer NOT NULL,
	`mode` text DEFAULT 'exam' NOT NULL,
	`attempt_no` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'started' NOT NULL,
	`student_no_snapshot` text NOT NULL,
	`student_name_snapshot` text NOT NULL,
	`campus_email_snapshot` text NOT NULL,
	`article_title_snapshot` text NOT NULL,
	`started_at` integer NOT NULL,
	`submitted_at` integer,
	`duration_seconds_allocated` integer NOT NULL,
	`duration_seconds_used` integer,
	`typed_text_raw` text DEFAULT '' NOT NULL,
	`typed_text_normalized` text DEFAULT '' NOT NULL,
	`char_count_typed` integer DEFAULT 0 NOT NULL,
	`char_count_correct` integer DEFAULT 0 NOT NULL,
	`char_count_error` integer DEFAULT 0 NOT NULL,
	`backspace_count` integer DEFAULT 0 NOT NULL,
	`paste_count` integer DEFAULT 0 NOT NULL,
	`suspicion_flags` text NOT NULL,
	`client_meta` text NOT NULL,
	`score_kpm` real DEFAULT 0 NOT NULL,
	`accuracy` real DEFAULT 0 NOT NULL,
	`score_version` text DEFAULT 'v1' NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "attempts_duration_seconds_allocated_positive_check" CHECK("attempts"."duration_seconds_allocated" > 0),
	CONSTRAINT "attempts_attempt_no_positive_check" CHECK("attempts"."attempt_no" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_student_attempt_no_unique` ON `attempts` (`student_id`,`attempt_no`);--> statement-breakpoint
CREATE INDEX `attempts_student_idx` ON `attempts` (`student_id`);--> statement-breakpoint
CREATE INDEX `attempts_article_idx` ON `attempts` (`article_id`);--> statement-breakpoint
CREATE INDEX `attempts_mode_idx` ON `attempts` (`mode`);--> statement-breakpoint
CREATE INDEX `attempts_status_idx` ON `attempts` (`status`);--> statement-breakpoint
CREATE INDEX `attempts_submitted_at_idx` ON `attempts` (`submitted_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_type` text NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`metadata` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_lookup_idx` ON `sessions` (`user_type`,`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_no` text NOT NULL,
	`name` text NOT NULL,
	`campus_email` text NOT NULL,
	`enrollment_year` text NOT NULL,
	`school_code` text NOT NULL,
	`major_code` text NOT NULL,
	`class_serial` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`email_verified_at` integer,
	`last_login_at` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "students_campus_email_ucass_check" CHECK(lower("students"."campus_email") like '%@ucass.edu.cn')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_student_no_unique` ON `students` (`student_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `students_campus_email_unique` ON `students` (`campus_email`);--> statement-breakpoint
CREATE INDEX `students_name_idx` ON `students` (`name`);--> statement-breakpoint
CREATE INDEX `students_enrollment_year_idx` ON `students` (`enrollment_year`);--> statement-breakpoint
CREATE INDEX `students_school_code_idx` ON `students` (`school_code`);--> statement-breakpoint
CREATE INDEX `students_major_code_idx` ON `students` (`major_code`);