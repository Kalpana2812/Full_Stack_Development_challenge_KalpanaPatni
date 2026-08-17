import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];

afterEach(async () => {
  delete process.env.LOCAL_ARTWORK_STORAGE_PATH;
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function configuredRoot() {
  const root = await mkdtemp(join(tmpdir(), "peblo-artwork-"));
  roots.push(root);
  process.env.LOCAL_ARTWORK_STORAGE_PATH = root;
  return root;
}

describe("Docker-local artwork storage", () => {
  it("writes a persistent image and returns a browser-local URL", async () => {
    await configuredRoot();
    const { putLocalArtwork, readLocalArtwork } = await import("./localStorage");
    const stored = await putLocalArtwork("artwork/8/poster.jpg", Buffer.from("image-bytes"));

    expect(stored).toEqual({ key: "artwork/8/poster.jpg", url: "/local-storage/artwork/8/poster.jpg" });
    await expect(readLocalArtwork(stored.key)).resolves.toMatchObject({ key: stored.key, content: Buffer.from("image-bytes") });
  });

  it("uses local storage before requiring Forge configuration", async () => {
    await configuredRoot();
    const { storagePut, storageGet } = await import("./storage");
    const stored = await storagePut("artwork/8/poster.jpg", Buffer.from("image-bytes"), "image/jpeg");

    expect(stored.key).toMatch(/^artwork\/8\/poster_[a-f0-9]{8}\.jpg$/);
    expect(stored.url).toBe(`/local-storage/${stored.key}`);
    await expect(storageGet(stored.key)).resolves.toEqual({ key: stored.key, url: stored.url });
  });

  it("rejects keys that escape the configured storage directory", async () => {
    await configuredRoot();
    const { putLocalArtwork } = await import("./localStorage");
    await expect(putLocalArtwork("../secret.jpg", Buffer.from("x"))).rejects.toThrow("Invalid local storage key.");
  });
});
