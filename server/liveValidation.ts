export type ValidationEpisode = {
  id: number;
  sourceEpisodeId: string;
  showId: number;
  contentGroup: string;
  language: string;
  durationSeconds: number | null;
  declaredArtworkKinds?: string[];
};

export type ValidationShow = { id: number; slug: string; section: string | null };
export type ValidationArtwork = { showId: number; episodeId: number | null; kind: "poster" | "banner" | "thumbnail" };

export type SeedValidationIssue = {
  id: number;
  sourceEpisodeId: string;
  showSlug: string;
  code: string;
  message: string;
};

export type LiveValidationIssue = SeedValidationIssue;

/**
 * Import-time duplicate rows have no episode database record, so an editor cannot
 * repair them in the CMS. Keep them visible as audit context without treating them
 * as a current-data publish blocker.
 */
export function getSeedValidationWarnings(seedIssues: SeedValidationIssue[], episodes: ValidationEpisode[]): LiveValidationIssue[] {
  return seedIssues
    .filter(issue => issue.code === "duplicate_content_group_language" && !episodes.some(episode => episode.sourceEpisodeId === issue.sourceEpisodeId))
    .map(issue => ({ ...issue, message: `${issue.message} The duplicate source row was skipped during import and is not in the editable catalogue.` }));
}

const messages: Record<string, string> = {
  missing_section: "The show needs a browse section before it can be published.",
  missing_duration: "Add the episode duration before it can be published.",
  missing_artwork: "Add poster, banner, and thumbnail artwork before it can be published.",
  duplicate_content_group_language: "This language variant duplicates another content group/language pair. Change either value before publishing.",
};

function currentIssue(episode: ValidationEpisode, showSlug: string, code: keyof typeof messages, offset: number): LiveValidationIssue {
  return {
    id: -(episode.id * 10 + offset),
    sourceEpisodeId: episode.sourceEpisodeId,
    showSlug,
    code,
    message: messages[code],
  };
}

function hasRequiredArtwork(episode: ValidationEpisode, allEpisodes: ValidationEpisode[], artwork: ValidationArtwork[]) {
  const hasShowAsset = (kind: "poster" | "banner") => artwork.some(asset => asset.showId === episode.showId && asset.episodeId === null && asset.kind === kind)
    || allEpisodes.some(item => item.showId === episode.showId && item.declaredArtworkKinds?.includes(kind));
  const hasEpisodeThumbnail = artwork.some(asset => asset.showId === episode.showId && asset.episodeId === episode.id && asset.kind === "thumbnail")
    || episode.declaredArtworkKinds?.includes("thumbnail");
  return hasShowAsset("poster") && hasShowAsset("banner") && hasEpisodeThumbnail;
}

/**
 * Directly recomputes publish blockers from the current CMS rows. Historical seed metadata is
 * deliberately excluded here because a skipped import row cannot be edited through the CMS.
 */
export function getLiveValidationIssues(
  _seedIssues: SeedValidationIssue[],
  episodes: ValidationEpisode[],
  shows: ValidationShow[],
  artwork: ValidationArtwork[],
): LiveValidationIssue[] {
  const showById = new Map(shows.map(show => [show.id, show]));
  const issues: LiveValidationIssue[] = [];

  for (const episode of episodes) {
    const show = showById.get(episode.showId);
    const showSlug = show?.slug ?? "unknown-show";
    if (!show?.section?.trim()) issues.push(currentIssue(episode, showSlug, "missing_section", 1));
    if (!episode.durationSeconds || episode.durationSeconds <= 0) issues.push(currentIssue(episode, showSlug, "missing_duration", 2));
    if (!hasRequiredArtwork(episode, episodes, artwork)) issues.push(currentIssue(episode, showSlug, "missing_artwork", 3));
  }

  const grouped = new Map<string, ValidationEpisode[]>();
  for (const episode of episodes) {
    const key = `${episode.contentGroup}\u0000${episode.language}`;
    grouped.set(key, [...(grouped.get(key) ?? []), episode]);
  }
  for (const duplicateEpisodes of grouped.values()) {
    for (const episode of duplicateEpisodes.slice(1)) {
      issues.push(currentIssue(episode, showById.get(episode.showId)?.slug ?? "unknown-show", "duplicate_content_group_language", 4));
    }
  }

  return issues;
}

/** Retained for narrow unit tests and source-data migration compatibility. */
export function isSeedIssueResolved(
  issue: Pick<SeedValidationIssue, "code" | "sourceEpisodeId">,
  episodes: ValidationEpisode[],
  shows: ValidationShow[],
  artwork: ValidationArtwork[],
) {
  return !getLiveValidationIssues([{ id: 0, showSlug: "seed", message: "seed", ...issue }], episodes, shows, artwork)
    .some(candidate => candidate.code === issue.code && candidate.sourceEpisodeId === issue.sourceEpisodeId);
}
