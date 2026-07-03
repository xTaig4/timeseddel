CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`weekly_norm_minutes` integer DEFAULT 2220 NOT NULL,
	`employment_start` text,
	`feriefridage_days` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`type` text DEFAULT 'work' NOT NULL,
	`start_minutes` integer,
	`end_minutes` integer,
	`break_minutes` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
