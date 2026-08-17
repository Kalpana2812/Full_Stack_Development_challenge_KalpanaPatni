import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "user" | "editor" | "admin"): TrpcContext {
  return {
    user: { id: 10, openId: `test-${role}`, name: role, email: null, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("CMS role enforcement", () => {
  it("does not allow an editor to invoke the admin-only publish procedure", async () => {
    const caller = appRouter.createCaller(contextFor("editor"));
    await expect(caller.cms.publish()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not allow a viewer to invoke editor procedures", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.cms.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
