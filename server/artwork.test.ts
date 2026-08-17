import { describe, expect, it } from "vitest";
import { validateArtworkUpload } from "./artwork";

function png(width: number, height: number, bytes = 24) {
  const data = Buffer.alloc(bytes);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(data, 0);
  data.writeUInt32BE(width, 16);
  data.writeUInt32BE(height, 20);
  return data;
}

describe("validateArtworkUpload", () => {
  it("accepts a correctly-sized poster within the byte ceiling", () => {
    const result = validateArtworkUpload("poster", png(600, 900));
    expect(result.ok).toBe(true);
  });

  it("returns human-readable aspect and dimension guidance", () => {
    const result = validateArtworkUpload("banner", png(600, 900));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/16:9.*too small/i);
  });

  it("rejects an oversized upload before persistence", () => {
    const result = validateArtworkUpload("thumbnail", png(640, 360, 200 * 1024 + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("smaller than 200 KB");
  });
});
