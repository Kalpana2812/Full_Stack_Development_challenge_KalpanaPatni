import { describe, expect, it } from "vitest";
import { isLocalAdminModeEnabled, matchesLocalAdminPassword } from "./localAuth";

describe("local admin authentication helpers", () => {
  it("requires an explicit local-only feature flag", () => {
    expect(isLocalAdminModeEnabled({ LOCAL_ADMIN_MODE: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isLocalAdminModeEnabled({ LOCAL_ADMIN_MODE: "false" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("matches only the configured password", () => {
    expect(matchesLocalAdminPassword("local-only-password", "local-only-password")).toBe(true);
    expect(matchesLocalAdminPassword("local-only-password", "wrong-password")).toBe(false);
    expect(matchesLocalAdminPassword(undefined, "local-only-password")).toBe(false);
  });
});
