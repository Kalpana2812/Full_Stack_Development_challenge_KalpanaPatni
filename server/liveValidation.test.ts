import { describe, expect, it } from "vitest";
import { getLiveValidationIssues, getSeedValidationWarnings, isSeedIssueResolved, type SeedValidationIssue } from "./liveValidation";

const seedIssues: SeedValidationIssue[] = [
  { id: 1, code: "missing_artwork", sourceEpisodeId: "ep_0036", showSlug: "moti", message: "Add poster, banner, and thumbnail artwork." },
  { id: 2, code: "missing_section", sourceEpisodeId: "ep_0036", showSlug: "moti", message: "Assign a browse section." },
];
const episodes = [{ id: 11, sourceEpisodeId: "ep_0036", showId: 5, contentGroup: "moti-36", language: "en", durationSeconds: 600, declaredArtworkKinds: [] }];

describe("live validation", () => {
  it("keeps missing artwork blocked until show poster/banner and the selected episode thumbnail exist", () => {
    const issue = seedIssues[0]!;
    expect(isSeedIssueResolved(issue, episodes, [{ id: 5, slug: "moti", section: "series" }], [])).toBe(false);
    expect(isSeedIssueResolved(issue, episodes, [{ id: 5, slug: "moti", section: "series" }], [
      { showId: 5, episodeId: null, kind: "poster" },
      { showId: 5, episodeId: null, kind: "banner" },
      { showId: 5, episodeId: 11, kind: "thumbnail" },
    ])).toBe(true);
  });

  it("removes repaired seed blockers and re-opens them if the current data becomes invalid again", () => {
    const repairedArtwork = [
      { showId: 5, episodeId: null, kind: "poster" as const },
      { showId: 5, episodeId: null, kind: "banner" as const },
      { showId: 5, episodeId: 11, kind: "thumbnail" as const },
    ];
    expect(getLiveValidationIssues(seedIssues, episodes, [{ id: 5, slug: "moti", section: null }], repairedArtwork).map(issue => issue.code)).toEqual(["missing_section"]);
    expect(getLiveValidationIssues(seedIssues, episodes, [{ id: 5, slug: "moti", section: "series" }], repairedArtwork)).toEqual([]);
    expect(getLiveValidationIssues(seedIssues, episodes, [{ id: 5, slug: "moti", section: "series" }], []).map(issue => issue.code)).toEqual(["missing_artwork"]);
  });

  it("surfaces a skipped duplicate import row as audit context rather than a current-data blocker", () => {
    const duplicate: SeedValidationIssue = { id: 3, code: "duplicate_content_group_language", sourceEpisodeId: "ep_0099", showSlug: "moti", message: "Duplicate pair." };
    expect(getLiveValidationIssues([duplicate], episodes, [{ id: 5, slug: "moti", section: "series" }], [])).not.toContainEqual(duplicate);
    expect(getSeedValidationWarnings([duplicate], episodes)).toMatchObject([{ sourceEpisodeId: "ep_0099", code: "duplicate_content_group_language" }]);
    const correctedReplacement = [...episodes, { id: 12, sourceEpisodeId: "ep_0099", showId: 5, contentGroup: "moti-99", language: "hi", durationSeconds: 600, declaredArtworkKinds: ["poster", "banner", "thumbnail"] }];
    expect(getSeedValidationWarnings([duplicate], correctedReplacement)).toEqual([]);
  });
});
