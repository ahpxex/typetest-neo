CREATE TABLE `auth_login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scope` text NOT NULL,
	`identifier` text NOT NULL,
	`ip_address` text,
	`was_successful` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_login_attempts_scope_identifier_created_at_idx` ON `auth_login_attempts` (`scope`,`identifier`,`created_at`);--> statement-breakpoint
CREATE INDEX `auth_login_attempts_scope_ip_created_at_idx` ON `auth_login_attempts` (`scope`,`ip_address`,`created_at`);