CREATE TABLE `importIssues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceEpisodeId` varchar(64) NOT NULL,
	`showSlug` varchar(160) NOT NULL,
	`code` varchar(80) NOT NULL,
	`message` text NOT NULL,
	`details` json NOT NULL,
	`resolved` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `importIssues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP INDEX `episodes_group_language_idx` ON `episodes`;--> statement-breakpoint
ALTER TABLE `episodes` ADD CONSTRAINT `episodes_group_language_unique` UNIQUE(`contentGroup`,`language`);--> statement-breakpoint
CREATE INDEX `import_issues_open_idx` ON `importIssues` (`resolved`);--> statement-breakpoint
CREATE INDEX `import_issues_show_idx` ON `importIssues` (`showSlug`);