CREATE TABLE `competitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`article_id` integer NOT NULL,
	`article_title_snapshot` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`duration_seconds` integer NOT NULL,
	`max_attempts_per_student` integer DEFAULT 1 NOT NULL,
	`start_at` integer,
	`end_at` integer,
	`created_by_admin_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin_users`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "competitions_duration_seconds_positive_check" CHECK("competitions"."duration_seconds" > 0),
	CONSTRAINT "competitions_max_attempts_positive_check" CHECK("competitions"."max_attempts_per_student" > 0),
	CONSTRAINT "competitions_window_order_check" CHECK("competitions"."start_at" is null or "competitions"."end_at" is null or "competitions"."end_at" > "competitions"."start_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitions_slug_unique` ON `competitions` (`slug`);--> statement-breakpoint
CREATE INDEX `competitions_status_idx` ON `competitions` (`status`);--> statement-breakpoint
CREATE INDEX `competitions_status_window_idx` ON `competitions` (`status`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `competitions_article_idx` ON `competitions` (`article_id`);--> statement-breakpoint
ALTER TABLE `attempts` ADD `competition_id` integer REFERENCES competitions(id);--> statement-breakpoint
CREATE INDEX `attempts_competition_ranking_idx` ON `attempts` (`competition_id`,`status`,"score_kpm" desc,"accuracy" desc,`submitted_at`);--> statement-breakpoint
CREATE INDEX `attempts_competition_student_idx` ON `attempts` (`competition_id`,`student_id`);