import seedRows from "../import/seed_shows.json";
import { and, eq } from "drizzle-orm";
import { episodes, importIssues, seasons, shows } from "../drizzle/schema";
import { getDb } from "./db";

type SeedRow = (typeof seedRows)[number];
const REQUIRED_ARTWORK = ["poster", "banner", "thumbnail"];

function issuesFor(row: SeedRow) {
  const flags: string[] = [];
  if (!row.section) flags.push("missing_section");
  if (!row.duration_seconds || row.duration_seconds <= 0) flags.push("missing_duration");
  if (!REQUIRED_ARTWORK.every(kind => row.artwork_available?.includes(kind))) flags.push("missing_artwork");
  return flags;
}

export async function seedPebloData() {
  const db = await getDb();
  if (!db) return { seeded: false, reason: "Database unavailable" };
  const present = await db.select({ id: shows.id }).from(shows).limit(1);
  if (present.length) return { seeded: false, reason: "Already seeded" };
  const showIds = new Map<string, number>();
  const seasonIds = new Map<string, number>();
  const duplicateKeys = new Map<string, string>();

  for (const row of seedRows) {
    let showId = showIds.get(row.slug);
    const flags = issuesFor(row);
    if (!showId) {
      await db.insert(shows).values({
        title: row.show_title,
        slug: row.slug,
        section: row.section || null,
        categories: row.categories,
        synopsis: row.synopsis,
        status: row.section ? "published" : "draft",
      });
      const created = await db.select({ id: shows.id }).from(shows).where(eq(shows.slug, row.slug)).limit(1);
      showId = created[0]!.id;
      showIds.set(row.slug, showId);
    }
    const seasonKey = `${showId}:${row.season_number}`;
    let seasonId = seasonIds.get(seasonKey);
    if (!seasonId) {
      await db.insert(seasons).values({ showId, number: row.season_number });
      const created = await db.select({ id: seasons.id }).from(seasons).where(and(eq(seasons.showId, showId), eq(seasons.number, row.season_number))).limit(1);
      seasonId = created[0]!.id;
      seasonIds.set(seasonKey, seasonId);
    }
    const pair = `${row.content_group}:${row.language}`;
    const original = duplicateKeys.get(pair);
    if (original) {
      await db.insert(importIssues).values({
        sourceEpisodeId: row.episode_id,
        showSlug: row.slug,
        code: "duplicate_content_group_language",
        message: `This language variant duplicates ${original}. Change either the content group or language before publishing.`,
        details: { contentGroup: row.content_group, language: row.language, originalEpisodeId: original },
      });
      continue;
    }
    duplicateKeys.set(pair, row.episode_id);
    await db.insert(episodes).values({
      sourceEpisodeId: row.episode_id,
      showId,
      seasonId,
      episodeNumber: row.episode_number,
      title: row.episode_title,
      durationSeconds: row.duration_seconds || null,
      language: row.language,
      contentGroup: row.content_group,
      status: flags.length ? "draft" : row.status === "published" ? "published" : "draft",
      declaredArtworkKinds: row.artwork_available,
      validationFlags: flags,
    });
    for (const flag of flags) {
      const messages: Record<string, string> = {
        missing_section: "The show needs a browse section before it can be published.",
        missing_duration: "Add the episode duration before it can be published.",
        missing_artwork: "Add poster, banner, and thumbnail artwork before it can be published.",
      };
      await db.insert(importIssues).values({ sourceEpisodeId: row.episode_id, showSlug: row.slug, code: flag, message: messages[flag]!, details: { artworkAvailable: row.artwork_available } });
    }
  }
  return { seeded: true, shows: showIds.size, sourceRows: seedRows.length };
}
