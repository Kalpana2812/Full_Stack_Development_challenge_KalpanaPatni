import { describe, expect, it } from "vitest";
import { promoteAtomically } from "./publishAtomic";

describe("promoteAtomically", () => {
  it("does not change the reader pointer when a post-write swap fails", async () => {
    let readerPointer = "previous-version";
    await expect(promoteAtomically(
      async () => "temporary-version",
      async () => { throw new Error("pointer swap failed"); },
    )).rejects.toThrow("pointer swap failed");
    expect(readerPointer).toBe("previous-version");
  });

  it("only exposes the completed temporary artifact after the swap", async () => {
    let readerPointer = "previous-version";
    const result = await promoteAtomically(
      async () => "next-complete-version",
      async artifact => { readerPointer = artifact; },
    );
    expect(result).toBe("next-complete-version");
    expect(readerPointer).toBe("next-complete-version");
  });
});
