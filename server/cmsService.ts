import { and, asc, eq, ne } from "drizzle-orm";
import { artwork, episodes, seasons, shows } from "../drizzle/schema";
import { getDb } from "./db";
import { validateArtworkUpload, type ArtworkKind } from "./artwork";
import { S3StorageAdapter } from "./catalogueStore";

const sections = ["featured", "series", "minisodes", "songs"] as const;
const languages = ["en", "hi"] as const;

export async function listCmsEpisodes(input: { query?: string; showId?: number; section?: string; status?: "draft" | "published"; language?: string; page?: number; pageSize?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0, page: 1, pageSize: input.pageSize ?? 10 };
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, input.pageSize ?? 10));
  const rows = await db.select({ episode: episodes, show: shows, season: seasons }).from(episodes).innerJoin(shows, eq(episodes.showId, shows.id)).innerJoin(seasons, eq(episodes.seasonId, seasons.id)).orderBy(asc(shows.title), asc(seasons.number), asc(episodes.episodeNumber));
  const query = input.query?.toLowerCase().trim();
  const filtered = rows.filter(row => (!query || [row.show.title, row.episode.title, row.episode.contentGroup, row.episode.sourceEpisodeId].some(value => value.toLowerCase().includes(query))) && (!input.showId || row.episode.showId === input.showId) && (!input.section || row.show.section === input.section) && (!input.status || row.episode.status === input.status) && (!input.language || row.episode.language === input.language));
  return { items: filtered.slice((page - 1) * pageSize, page * pageSize).map(row => ({ ...row.episode, showTitle: row.show.title, showSlug: row.show.slug, section: row.show.section, seasonNumber: row.season.number })), total: filtered.length, page, pageSize };
}

export async function listCmsSeasons(showId?: number) {
  const db = await getDb();
  if (!db || !showId) return [];
  return db.select().from(seasons).where(eq(seasons.showId, showId)).orderBy(asc(seasons.number));
}

export async function saveShow(input: { id?: number; title: string; slug: string; section?: string | null; categories: string[]; synopsis: string; status: "draft" | "published" }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (input.status === "published" && !input.section) throw new Error("Choose a browse section before publishing this show.");
  if (input.section && !sections.includes(input.section as (typeof sections)[number])) throw new Error("Choose one of the approved browse sections.");
  const values = { title: input.title.trim(), slug: input.slug.trim(), section: input.section ?? null, categories: input.categories, synopsis: input.synopsis.trim(), status: input.status } as const;
  if (input.id) { await db.update(shows).set(values).where(eq(shows.id, input.id)); return input.id; }
  const created = await db.insert(shows).values(values);
  return Number(created[0].insertId);
}

export async function saveSeason(input: { id?: number; showId: number; number: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (!Number.isInteger(input.number) || input.number < 0) throw new Error("Season number must be zero or a positive whole number.");
  if (input.id) { await db.update(seasons).set({ number: input.number }).where(eq(seasons.id, input.id)); return input.id; }
  const created = await db.insert(seasons).values({ showId: input.showId, number: input.number });
  return Number(created[0].insertId);
}

export async function saveEpisode(input: { id?: number; showId: number; seasonId: number; sourceEpisodeId: string; episodeNumber: number; title: string; durationSeconds?: number | null; language: string; contentGroup: string; status: "draft" | "published"; declaredArtworkKinds?: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (!languages.includes(input.language as (typeof languages)[number])) throw new Error("Language must be English (en) or Hindi (hi).");
  const existing = await db.select().from(episodes).where(and(eq(episodes.contentGroup, input.contentGroup), eq(episodes.language, input.language), input.id ? ne(episodes.id, input.id) : undefined)).limit(1);
  if (existing.length) throw new Error("This content group already has an episode in that language. Update the existing variant instead.");
  const show = await db.select().from(shows).where(eq(shows.id, input.showId)).limit(1);
  const uploaded = input.id ? await db.select().from(artwork).where(eq(artwork.episodeId, input.id)) : [];
  const hasArtwork = input.declaredArtworkKinds?.includes("thumbnail") || uploaded.some(asset => asset.kind === "thumbnail");
  if (input.status === "published") {
    if (!show[0]?.section) throw new Error("Assign the show to a browse section before publishing an episode.");
    if (!input.durationSeconds || input.durationSeconds <= 0) throw new Error("Add a positive duration before publishing this episode.");
    if (!hasArtwork) throw new Error("Upload a thumbnail before publishing this episode.");
  }
  const values = { showId: input.showId, seasonId: input.seasonId, sourceEpisodeId: input.sourceEpisodeId.trim(), episodeNumber: input.episodeNumber, title: input.title.trim(), durationSeconds: input.durationSeconds ?? null, language: input.language, contentGroup: input.contentGroup.trim(), status: input.status, declaredArtworkKinds: input.declaredArtworkKinds ?? [], validationFlags: [] as string[] };
  if (input.id) { await db.update(episodes).set(values).where(eq(episodes.id, input.id)); return input.id; }
  const created = await db.insert(episodes).values(values);
  return Number(created[0].insertId);
}

export async function deleteContent(kind: "show" | "season" | "episode", id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (kind === "show") await db.delete(shows).where(eq(shows.id, id));
  if (kind === "season") await db.delete(seasons).where(eq(seasons.id, id));
  if (kind === "episode") await db.delete(episodes).where(eq(episodes.id, id));
  return { deleted: true };
}

export async function uploadArtwork(input: { kind: ArtworkKind; showId: number; episodeId?: number | null; filename: string; dataBase64: string }) {
  if (input.kind === "thumbnail" && !input.episodeId) throw new Error("Choose the episode that owns this thumbnail.");
  if (input.kind !== "thumbnail" && input.episodeId) throw new Error("Poster and banner artwork must be attached to a show, not an episode.");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (input.episodeId) {
    const episode = await db.select({ id: episodes.id }).from(episodes).where(and(eq(episodes.id, input.episodeId), eq(episodes.showId, input.showId))).limit(1);
    if (!episode[0]) throw new Error("Choose an episode that belongs to the selected show.");
  }
  const bytes = Buffer.from(input.dataBase64, "base64");
  const validation = validateArtworkUpload(input.kind, bytes);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
  const storage = new S3StorageAdapter();
  const extension = validation.image.mimeType === "image/png" ? "png" : "jpg";
  const stored = await storage.put(`artwork/${input.showId}/${input.kind}-${input.episodeId ?? "show"}-${Date.now()}.${extension}`, bytes, validation.image.mimeType);
  const created = await db.insert(artwork).values({ showId: input.showId, episodeId: input.episodeId ?? null, kind: input.kind, fileKey: stored.key, url: stored.url, width: validation.image.width, height: validation.image.height, sizeBytes: bytes.byteLength, mimeType: validation.image.mimeType });
  return { id: Number(created[0].insertId), ...stored, width: validation.image.width, height: validation.image.height };
}
