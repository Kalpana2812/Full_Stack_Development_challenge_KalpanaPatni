import { and, desc, eq, inArray } from "drizzle-orm";
import { artwork, catalogueSnapshots, catalogueState, episodes, importIssues, publishRuns, seasons, shows } from "../drizzle/schema";
import { buildCatalogue, filterCatalogue, type Catalogue } from "./catalogue";
import { getDb } from "./db";
import { createStorageAdapter, writeCatalogueSnapshot } from "./catalogueStore";
import { getLiveValidationIssues, getSeedValidationWarnings } from "./liveValidation";
import { promoteAtomically } from "./publishAtomic";

const ARTWORK_TYPES = ["poster", "banner", "thumbnail"] as const;

function generatedArtwork(slug: string, kind: string, title: string) {
  const sizes: Record<string, [number, number]> = { poster: [600, 900], banner: [1280, 720], thumbnail: [640, 360] };
  const [width, height] = sizes[kind] ?? sizes.thumbnail;
  const palette = slug.split("").reduce((total, char) => total + char.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${palette} 80% 54%)"/><stop offset="1" stop-color="hsl(${(palette + 76) % 360} 70% 25%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${width * 0.78}" cy="${height * 0.22}" r="${Math.min(width, height) * 0.22}" fill="white" fill-opacity=".12"/><text x="${width * 0.08}" y="${height * 0.72}" fill="white" font-family="Arial,sans-serif" font-size="${Math.max(20, width / 14)}" font-weight="700">${title.replace(/[<&>]/g, "")}</text><text x="${width * 0.08}" y="${height * 0.84}" fill="white" fill-opacity=".78" font-family="Arial,sans-serif" font-size="${Math.max(15, width / 25)}">PEBLO ORIGINAL</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export async function getValidationReport() {
  const db = await getDb();
  if (!db) return { blocked: true, total: 1, blockerTotal: 1, warningTotal: 0, groups: [{ code: "database_unavailable", label: "Database unavailable", blocking: true, issues: [{ id: -1, sourceEpisodeId: "system", showSlug: "system", message: "Connect a database to validate the catalogue." }] }] };
  const [issueRows, episodeRows, showRows, artworkRows] = await Promise.all([
    db.select().from(importIssues),
    db.select().from(episodes),
    db.select().from(shows),
    db.select().from(artwork),
  ]);
  const blockingIssues = getLiveValidationIssues(issueRows, episodeRows, showRows, artworkRows);
  const warnings = getSeedValidationWarnings(issueRows, episodeRows);
  const visibleIssueKeys = new Set([...blockingIssues, ...warnings].map(issue => `${issue.sourceEpisodeId}:${issue.code}`));
  const statusChanges = issueRows.filter(issue => issue.resolved !== !visibleIssueKeys.has(`${issue.sourceEpisodeId}:${issue.code}`));
  await Promise.all(statusChanges.map(issue => db.update(importIssues).set({ resolved: !visibleIssueKeys.has(`${issue.sourceEpisodeId}:${issue.code}`) }).where(eq(importIssues.id, issue.id))));
  const groupedIssues = [
    ...blockingIssues.map(issue => ({ ...issue, blocking: true })),
    ...warnings.map(issue => ({ ...issue, blocking: false })),
  ];
  const groups = [...new Map(groupedIssues.map(issue => [`${issue.blocking ? "blocker" : "warning"}:${issue.code}`, groupedIssues.filter(other => other.blocking === issue.blocking && other.code === issue.code)])).entries()].map(([groupKey, issues]) => {
    const [severity, rawCode] = groupKey.split(":") as ["blocker" | "warning", string];
    return {
      code: severity === "warning" ? `warning_${rawCode}` : rawCode,
      label: severity === "warning" ? "Skipped import warning" : rawCode.replaceAll("_", " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase()),
      blocking: severity === "blocker",
      issues: issues.map(issue => ({ id: issue.id, sourceEpisodeId: issue.sourceEpisodeId, showSlug: issue.showSlug, message: issue.message })),
    };
  });
  return { blocked: blockingIssues.length > 0, total: groupedIssues.length, blockerTotal: blockingIssues.length, warningTotal: warnings.length, groups };
}

export async function composeCatalogue(version: string): Promise<Catalogue> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const showRows = await db.select().from(shows).where(and(eq(shows.status, "published")));
  const showIds = showRows.filter(show => Boolean(show.section)).map(show => show.id);
  if (!showIds.length) return buildCatalogue([], version);
  const seasonRows = await db.select().from(seasons).where(inArray(seasons.showId, showIds));
  const episodeRows = await db.select().from(episodes).where(and(inArray(episodes.showId, showIds), eq(episodes.status, "published")));
  const uploadedArtwork = await db.select().from(artwork).where(inArray(artwork.showId, showIds));
  const showArtworkByKind = new Map<number, Map<string, string>>();
  const episodeThumbnailById = new Map<number, string>();
  for (const asset of uploadedArtwork) {
    if (asset.kind === "thumbnail" && asset.episodeId) {
      episodeThumbnailById.set(asset.episodeId, asset.url);
      continue;
    }
    const map = showArtworkByKind.get(asset.showId) ?? new Map<string, string>();
    map.set(asset.kind, asset.url);
    showArtworkByKind.set(asset.showId, map);
  }
  const seasonNumber = new Map(seasonRows.map(season => [season.id, season.number]));
  return buildCatalogue(showRows.filter(show => show.section).map(show => ({
    id: show.id,
    title: show.title,
    slug: show.slug,
    section: show.section!,
    categories: show.categories,
    synopsis: show.synopsis,
    posterUrl: showArtworkByKind.get(show.id)?.get("poster") ?? generatedArtwork(show.slug, "poster", show.title),
    bannerUrl: showArtworkByKind.get(show.id)?.get("banner") ?? generatedArtwork(show.slug, "banner", show.title),
    episodes: episodeRows.filter(episode => episode.showId === show.id).map(episode => ({
      contentGroup: episode.contentGroup,
      title: episode.title,
      episodeNumber: episode.episodeNumber,
      durationSeconds: episode.durationSeconds,
      language: episode.language,
      seasonNumber: seasonNumber.get(episode.seasonId) ?? 1,
      thumbnailUrl: episodeThumbnailById.get(episode.id) ?? generatedArtwork(show.slug, "thumbnail", episode.title),
    })),
  })), version);
}

export async function getActiveCatalogue() {
  const db = await getDb();
  if (!db) return null;
  const pointer = await db.select().from(catalogueState).where(eq(catalogueState.name, "active")).limit(1);
  if (!pointer[0]?.activeSnapshotId) return null;
  const snapshot = await db.select().from(catalogueSnapshots).where(eq(catalogueSnapshots.id, pointer[0].activeSnapshotId)).limit(1);
  return (snapshot[0]?.payload as Catalogue | undefined) ?? null;
}

export async function publishCatalogue(triggeredByUserId: number | null, options: { allowIssues?: boolean } = {}) {
  const report = await getValidationReport();
  if (report.blocked && !options.allowIssues) return { ok: false as const, report };
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const version = `catalogue-${Date.now()}`;
  const run = await db.insert(publishRuns).values({ triggeredByUserId, status: "running", errorSummary: [] });
  const runId = Number(run[0].insertId);
  try {
    const payload = await composeCatalogue(version);
    const showCount = payload.sections.reduce((count, section) => count + section.shows.length, 0);
    const episodeCount = payload.sections.flatMap(section => section.shows).reduce((count, show) => count + show.seasons.reduce((sum, season) => sum + season.episodes.length, 0), 0);
    const storage = createStorageAdapter();
    const artifact = await writeCatalogueSnapshot(storage, version, payload);
    let snapshotId = 0;
    await promoteAtomically(async () => artifact, async staged => {
      snapshotId = await db.transaction(async tx => {
        const insert = await tx.insert(catalogueSnapshots).values({ version, state: "staging", payload, storageKey: staged.storageKey });
        const nextSnapshotId = Number(insert[0].insertId);
        await tx.update(catalogueSnapshots).set({ state: "superseded" }).where(eq(catalogueSnapshots.state, "active"));
        await tx.update(catalogueSnapshots).set({ state: "active" }).where(eq(catalogueSnapshots.id, nextSnapshotId));
        await tx.insert(catalogueState).values({ name: "active", activeSnapshotId: nextSnapshotId }).onDuplicateKeyUpdate({ set: { activeSnapshotId: nextSnapshotId } });
        return nextSnapshotId;
      });
    });
    await db.update(publishRuns).set({ status: "succeeded", completedAt: new Date(), snapshotId, showCount, episodeCount, groupedEpisodeCount: episodeCount, outcome: "Atomically promoted a complete catalogue snapshot." }).where(eq(publishRuns.id, runId));
    return { ok: true as const, payload, version, runId };
  } catch (error) {
    await db.update(publishRuns).set({ status: "failed", completedAt: new Date(), outcome: "Catalogue publication failed before promotion.", errorSummary: [error instanceof Error ? error.message : "Unknown publishing error"] }).where(eq(publishRuns.id, runId));
    throw error;
  }
}

export async function searchActiveCatalogue(filters: { q?: string; category?: string; language?: string; section?: string }) {
  const catalogue = await getActiveCatalogue();
  return catalogue ? filterCatalogue(catalogue, filters) : null;
}

export async function getCmsOverview() {
  const db = await getDb();
  const report = await getValidationReport();
  if (!db) return { report, shows: [], runs: [] };
  const allShows = await db.select().from(shows);
  const allEpisodes = await db.select().from(episodes);
  const runs = await db.select().from(publishRuns).orderBy(desc(publishRuns.startedAt)).limit(10);
  return { report, shows: allShows.map(show => ({ ...show, episodeCount: allEpisodes.filter(episode => episode.showId === show.id).length })), runs };
}

export { ARTWORK_TYPES };
