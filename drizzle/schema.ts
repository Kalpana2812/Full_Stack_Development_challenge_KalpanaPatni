import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "editor", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const shows = mysqlTable(
  "shows",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    section: varchar("section", { length: 32 }),
    categories: json("categories").$type<string[]>().notNull(),
    synopsis: text("synopsis").notNull(),
    status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("shows_slug_unique").on(table.slug), index("shows_section_status_idx").on(table.section, table.status)]
);

export const seasons = mysqlTable(
  "seasons",
  {
    id: int("id").autoincrement().primaryKey(),
    showId: int("showId").notNull().references(() => shows.id, { onDelete: "cascade" }),
    number: int("number").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("seasons_show_number_unique").on(table.showId, table.number)]
);

export const episodes = mysqlTable(
  "episodes",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceEpisodeId: varchar("sourceEpisodeId", { length: 64 }).notNull(),
    showId: int("showId").notNull().references(() => shows.id, { onDelete: "cascade" }),
    seasonId: int("seasonId").notNull().references(() => seasons.id, { onDelete: "cascade" }),
    episodeNumber: int("episodeNumber").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    durationSeconds: int("durationSeconds"),
    language: varchar("language", { length: 8 }).notNull(),
    contentGroup: varchar("contentGroup", { length: 255 }).notNull(),
    status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
    declaredArtworkKinds: json("declaredArtworkKinds").$type<string[]>().notNull(),
    validationFlags: json("validationFlags").$type<string[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("episodes_source_id_unique").on(table.sourceEpisodeId),
    index("episodes_show_season_order_idx").on(table.showId, table.seasonId, table.episodeNumber),
    uniqueIndex("episodes_group_language_unique").on(table.contentGroup, table.language),
    index("episodes_status_idx").on(table.status),
  ]
);

export const artwork = mysqlTable(
  "artwork",
  {
    id: int("id").autoincrement().primaryKey(),
    showId: int("showId").notNull().references(() => shows.id, { onDelete: "cascade" }),
    episodeId: int("episodeId").references(() => episodes.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["poster", "banner", "thumbnail"]).notNull(),
    fileKey: varchar("fileKey", { length: 512 }).notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    width: int("width").notNull(),
    height: int("height").notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    mimeType: varchar("mimeType", { length: 96 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("artwork_show_kind_idx").on(table.showId, table.kind), index("artwork_episode_kind_idx").on(table.episodeId, table.kind)]
);

export const catalogueSnapshots = mysqlTable(
  "catalogueSnapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    version: varchar("version", { length: 96 }).notNull(),
    state: mysqlEnum("state", ["staging", "active", "superseded", "failed"]).default("staging").notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("catalogue_snapshot_version_unique").on(table.version), index("catalogue_snapshot_state_idx").on(table.state)]
);

export const catalogueState = mysqlTable("catalogueState", {
  name: varchar("name", { length: 32 }).primaryKey(),
  activeSnapshotId: int("activeSnapshotId").references(() => catalogueSnapshots.id, { onDelete: "set null" }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const importIssues = mysqlTable(
  "importIssues",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceEpisodeId: varchar("sourceEpisodeId", { length: 64 }).notNull(),
    showSlug: varchar("showSlug", { length: 160 }).notNull(),
    code: varchar("code", { length: 80 }).notNull(),
    message: text("message").notNull(),
    details: json("details").$type<Record<string, unknown>>().notNull(),
    resolved: boolean("resolved").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("import_issues_open_idx").on(table.resolved), index("import_issues_show_idx").on(table.showSlug)]
);

export const publishRuns = mysqlTable(
  "publishRuns",
  {
    id: int("id").autoincrement().primaryKey(),
    triggeredByUserId: int("triggeredByUserId").references(() => users.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ["running", "succeeded", "failed", "blocked"]).notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    showCount: int("showCount").default(0).notNull(),
    episodeCount: int("episodeCount").default(0).notNull(),
    groupedEpisodeCount: int("groupedEpisodeCount").default(0).notNull(),
    snapshotId: int("snapshotId").references(() => catalogueSnapshots.id, { onDelete: "set null" }),
    outcome: text("outcome"),
    errorSummary: json("errorSummary").$type<string[]>().notNull(),
  },
  table => [index("publish_runs_started_idx").on(table.startedAt), index("publish_runs_status_idx").on(table.status)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Show = typeof shows.$inferSelect;
export type Episode = typeof episodes.$inferSelect;
