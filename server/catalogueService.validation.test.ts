import { beforeEach, describe, expect, it, vi } from "vitest";
import { artwork, episodes, importIssues, shows } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { getValidationReport, publishCatalogue } from "./catalogueService";

type State = { issues: unknown[]; episodeRows: unknown[]; showRows: unknown[]; artworkRows: unknown[] };

function createDb(state: State) {
  const rowsFor = (table: unknown) => {
    if (table === importIssues) return state.issues;
    if (table === episodes) return state.episodeRows;
    if (table === shows) return state.showRows;
    if (table === artwork) return state.artworkRows;
    return [];
  };
  return {
    select: vi.fn(() => ({ from: vi.fn((table: unknown) => Promise.resolve(rowsFor(table))) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
  };
}

function invalidState(): State {
  return {
    issues: [],
    showRows: [{ id: 4, slug: "moti", section: null }],
    episodeRows: [{ id: 19, sourceEpisodeId: "ep_0036", showId: 4, contentGroup: "moti-36", language: "en", durationSeconds: 600, declaredArtworkKinds: [] }],
    artworkRows: [],
  };
}

describe("current CMS validation report", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks publication for current invalid CMS data even with no historical import issue", async () => {
    mocks.getDb.mockResolvedValue(createDb(invalidState()));
    const report = await getValidationReport();
    expect(report).toMatchObject({ blocked: true, total: 2 });
    expect(report.groups.map(group => group.code).sort()).toEqual(["missing_artwork", "missing_section"]);

    const publish = await publishCatalogue(null);
    expect(publish).toMatchObject({ ok: false, report: { blocked: true, total: 2 } });
  });

  it("clears blockers after current section and required artwork are repaired", async () => {
    const repaired = invalidState();
    repaired.showRows = [{ id: 4, slug: "moti", section: "series" }];
    repaired.artworkRows = [
      { showId: 4, episodeId: null, kind: "poster" },
      { showId: 4, episodeId: null, kind: "banner" },
      { showId: 4, episodeId: 19, kind: "thumbnail" },
    ];
    mocks.getDb.mockResolvedValue(createDb(repaired));
    await expect(getValidationReport()).resolves.toMatchObject({ blocked: false, total: 0, groups: [] });
  });

  it("keeps a skipped duplicate source row visible as a warning without blocking a valid catalogue", async () => {
    const repaired = invalidState();
    repaired.showRows = [{ id: 4, slug: "moti", section: "series" }];
    repaired.artworkRows = [
      { showId: 4, episodeId: null, kind: "poster" },
      { showId: 4, episodeId: null, kind: "banner" },
      { showId: 4, episodeId: 19, kind: "thumbnail" },
    ];
    repaired.issues = [{ id: 9, sourceEpisodeId: "ep_9001", showSlug: "moti", code: "duplicate_content_group_language", message: "Skipped duplicate.", resolved: false }];
    mocks.getDb.mockResolvedValue(createDb(repaired));
    const report = await getValidationReport();
    expect(report).toMatchObject({ blocked: false, total: 1, blockerTotal: 0, warningTotal: 1 });
    expect(report.groups).toMatchObject([{ code: "warning_duplicate_content_group_language", blocking: false }]);
  });
});
