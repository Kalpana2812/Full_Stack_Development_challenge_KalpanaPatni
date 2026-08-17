CREATE TABLE `artwork` (
	`id` int AUTO_INCREMENT NOT NULL,
	`showId` int NOT NULL,
	`episodeId` int,
	`kind` enum('poster','banner','thumbnail') NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`sizeBytes` int NOT NULL,
	`mimeType` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artwork_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `catalogueSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` varchar(96) NOT NULL,
	`state` enum('staging','active','superseded','failed') NOT NULL DEFAULT 'staging',
	`payload` json NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `catalogueSnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `catalogue_snapshot_version_unique` UNIQUE(`version`)
);
--> statement-breakpoint
CREATE TABLE `catalogueState` (
	`name` varchar(32) NOT NULL,
	`activeSnapshotId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalogueState_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceEpisodeId` varchar(64) NOT NULL,
	`showId` int NOT NULL,
	`seasonId` int NOT NULL,
	`episodeNumber` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`durationSeconds` int,
	`language` varchar(8) NOT NULL,
	`contentGroup` varchar(255) NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`declaredArtworkKinds` json NOT NULL,
	`validationFlags` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `episodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `episodes_source_id_unique` UNIQUE(`sourceEpisodeId`)
);
--> statement-breakpoint
CREATE TABLE `publishRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggeredByUserId` int,
	`status` enum('running','succeeded','failed','blocked') NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`showCount` int NOT NULL DEFAULT 0,
	`episodeCount` int NOT NULL DEFAULT 0,
	`groupedEpisodeCount` int NOT NULL DEFAULT 0,
	`snapshotId` int,
	`outcome` text,
	`errorSummary` json NOT NULL,
	CONSTRAINT `publishRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`showId` int NOT NULL,
	`number` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seasons_id` PRIMARY KEY(`id`),
	CONSTRAINT `seasons_show_number_unique` UNIQUE(`showId`,`number`)
);
--> statement-breakpoint
CREATE TABLE `shows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`section` varchar(32),
	`categories` json NOT NULL,
	`synopsis` text NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shows_id` PRIMARY KEY(`id`),
	CONSTRAINT `shows_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','editor','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `artwork` ADD CONSTRAINT `artwork_showId_shows_id_fk` FOREIGN KEY (`showId`) REFERENCES `shows`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artwork` ADD CONSTRAINT `artwork_episodeId_episodes_id_fk` FOREIGN KEY (`episodeId`) REFERENCES `episodes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalogueState` ADD CONSTRAINT `catalogueState_activeSnapshotId_catalogueSnapshots_id_fk` FOREIGN KEY (`activeSnapshotId`) REFERENCES `catalogueSnapshots`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `episodes` ADD CONSTRAINT `episodes_showId_shows_id_fk` FOREIGN KEY (`showId`) REFERENCES `shows`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `episodes` ADD CONSTRAINT `episodes_seasonId_seasons_id_fk` FOREIGN KEY (`seasonId`) REFERENCES `seasons`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publishRuns` ADD CONSTRAINT `publishRuns_triggeredByUserId_users_id_fk` FOREIGN KEY (`triggeredByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publishRuns` ADD CONSTRAINT `publishRuns_snapshotId_catalogueSnapshots_id_fk` FOREIGN KEY (`snapshotId`) REFERENCES `catalogueSnapshots`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seasons` ADD CONSTRAINT `seasons_showId_shows_id_fk` FOREIGN KEY (`showId`) REFERENCES `shows`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `artwork_show_kind_idx` ON `artwork` (`showId`,`kind`);--> statement-breakpoint
CREATE INDEX `artwork_episode_kind_idx` ON `artwork` (`episodeId`,`kind`);--> statement-breakpoint
CREATE INDEX `catalogue_snapshot_state_idx` ON `catalogueSnapshots` (`state`);--> statement-breakpoint
CREATE INDEX `episodes_show_season_order_idx` ON `episodes` (`showId`,`seasonId`,`episodeNumber`);--> statement-breakpoint
CREATE INDEX `episodes_group_language_idx` ON `episodes` (`contentGroup`,`language`);--> statement-breakpoint
CREATE INDEX `episodes_status_idx` ON `episodes` (`status`);--> statement-breakpoint
CREATE INDEX `publish_runs_started_idx` ON `publishRuns` (`startedAt`);--> statement-breakpoint
CREATE INDEX `publish_runs_status_idx` ON `publishRuns` (`status`);--> statement-breakpoint
CREATE INDEX `shows_section_status_idx` ON `shows` (`section`,`status`);