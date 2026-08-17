import { describe, expect, it } from "vitest";
import { emptyEpisodeEditorForm, loadEpisodeForEditing } from "../client/src/lib/episodeEditor";

describe("CMS episode editor state", () => {
  it("loads an existing episode's real ID and all remediation fields into the controlled editor form", () => {
    expect(loadEpisodeForEditing({
      id: 19,
      seasonId: 7,
      sourceEpisodeId: "ep_0036",
      episodeNumber: 4,
      title: "The Repairable Episode",
      durationSeconds: 600,
      language: "hi",
      contentGroup: "moti-36-hi",
      status: "draft",
      declaredArtworkKinds: ["poster", "banner"],
    })).toEqual({
      id: 19,
      form: { seasonId: "7", sourceEpisodeId: "ep_0036", episodeNumber: "4", title: "The Repairable Episode", durationSeconds: "600", language: "hi", contentGroup: "moti-36-hi", status: "draft", declaredArtworkKinds: ["poster", "banner"] },
    });
  });

  it("keeps the create form empty after an edit is saved or cancelled", () => {
    expect(emptyEpisodeEditorForm).toMatchObject({ seasonId: "", sourceEpisodeId: "", durationSeconds: "", status: "draft", declaredArtworkKinds: [] });
  });
});
