import { describe, expect, it } from "vitest";
import { buildCatalogue, collapseLanguageVariants } from "./catalogue";

describe("collapseLanguageVariants", () => {
  it("collapses language variants into one episode with a sorted languages list", () => {
    const result = collapseLanguageVariants([
      { contentGroup: "story-1", title: "Story one", episodeNumber: 2, durationSeconds: 420, language: "hi", seasonNumber: 1, thumbnailUrl: "hi" },
      { contentGroup: "story-1", title: "Story one", episodeNumber: 2, durationSeconds: 420, language: "en", seasonNumber: 1, thumbnailUrl: "en" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].episode.languages).toEqual(["en", "hi"]);
    expect(result[0].episode.thumbnailUrl).toBe("en");
  });

  it("keeps season-zero trailers outside normal seasons and sorts sections deterministically", () => {
    const catalogue = buildCatalogue([
      { id: 1, title: "Zebra", slug: "zebra", section: "series", categories: [], synopsis: "", posterUrl: "poster", bannerUrl: "banner", episodes: [{ contentGroup: "trailer", title: "Trailer", episodeNumber: 1, durationSeconds: 20, language: "en", seasonNumber: 0, thumbnailUrl: "thumb" }] },
      { id: 2, title: "Alpha", slug: "alpha", section: "featured", categories: [], synopsis: "", posterUrl: "poster", bannerUrl: "banner", episodes: [{ contentGroup: "episode", title: "Episode", episodeNumber: 1, durationSeconds: 20, language: "en", seasonNumber: 1, thumbnailUrl: "thumb" }] },
    ], "test-version");
    expect(catalogue.sections.map(section => section.id)).toEqual(["featured", "series"]);
    expect(catalogue.sections[1].shows[0].seasons).toEqual([]);
    expect(catalogue.sections[1].shows[0].trailers).toHaveLength(1);
  });
});
