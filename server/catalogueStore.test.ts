import { describe, expect, it } from "vitest";
import { MemoryStorageAdapter, writeCatalogueSnapshot } from "./catalogueStore";

describe("swappable catalogue storage", () => {
  it("writes a temporary snapshot through the in-memory adapter without S3 coupling", async () => {
    const storage = new MemoryStorageAdapter();
    const snapshot = await writeCatalogueSnapshot(storage, "test-release", { version: "test-release" });
    expect(snapshot.temporaryKey).toBe("catalogue/.tmp/test-release.json");
    expect(storage.objects.get(snapshot.temporaryKey)?.content.toString()).toContain("test-release");
  });
});
