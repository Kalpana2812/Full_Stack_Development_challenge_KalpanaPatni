import { timingSafeEqual } from "node:crypto";

export function isLocalAdminModeEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.LOCAL_ADMIN_MODE === "true";
}

export function matchesLocalAdminPassword(expected: string | undefined, supplied: string) {
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
