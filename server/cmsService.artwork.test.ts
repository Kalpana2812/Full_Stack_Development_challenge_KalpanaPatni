import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  put: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./catalogueStore", () => ({
  S3StorageAdapter: class {
    put = mocks.put;
  },
}));

import { uploadArtwork } from "./cmsService";

function png(width: number, height: number) {
  const data = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(data, 0);
  data.writeUInt32BE(width, 16);
  data.writeUInt32BE(height, 20);
  return data.toString("base64");
}

function createDb(ownedEpisodeRows: Array<{ id: number }>) {
  const insertValues = vi.fn().mockResolvedValue([{ insertId: 72 }]);
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue(ownedEpisodeRows) })),
      })),
    })),
    insert: vi.fn(() => ({ values: insertValues })),
    insertValues,
  };
}

describe("CMS artwork upload service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.put.mockResolvedValue({ key: "artwork/4/thumbnail-19.png", url: "memory://artwork/4/thumbnail-19.png" });
  });

  it("requires an explicit existing episode for thumbnail uploads", async () => {
    await expect(uploadArtwork({ kind: "thumbnail", showId: 4, episodeId: null, filename: "thumb.png", dataBase64: png(640, 360) }))
      .rejects.toThrow("Choose the episode that owns this thumbnail.");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects a thumbnail episode that belongs to a different selected show", async () => {
    const db = createDb([]);
    mocks.getDb.mockResolvedValue(db);
    await expect(uploadArtwork({ kind: "thumbnail", showId: 4, episodeId: 19, filename: "thumb.png", dataBase64: png(640, 360) }))
      .rejects.toThrow("Choose an episode that belongs to the selected show.");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("persists the selected episode ID through the actual CMS upload service", async () => {
    const db = createDb([{ id: 19 }]);
    mocks.getDb.mockResolvedValue(db);
    const uploaded = await uploadArtwork({ kind: "thumbnail", showId: 4, episodeId: 19, filename: "thumb.png", dataBase64: png(640, 360) });
    expect(uploaded).toMatchObject({ id: 72, url: "memory://artwork/4/thumbnail-19.png", width: 640, height: 360 });
    expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ showId: 4, episodeId: 19, kind: "thumbnail" }));
  });
});
