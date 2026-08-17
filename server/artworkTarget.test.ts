import { describe, expect, it } from "vitest";
import { getArtworkUploadTarget } from "../client/src/lib/artworkTarget";

describe("CMS artwork upload targets", () => {
  it("requires a selected existing episode for a thumbnail", () => {
    expect(getArtworkUploadTarget("thumbnail", 4, null)).toEqual({ ok: false, message: "Choose the episode that needs this thumbnail." });
    expect(getArtworkUploadTarget("thumbnail", 4, 19)).toEqual({ ok: true, showId: 4, episodeId: 19 });
  });

  it("binds poster and banner uploads to the selected show, never an arbitrary episode", () => {
    expect(getArtworkUploadTarget("poster", 4, 19)).toEqual({ ok: true, showId: 4, episodeId: null });
    expect(getArtworkUploadTarget("banner", 4, 19)).toEqual({ ok: true, showId: 4, episodeId: null });
  });
});
