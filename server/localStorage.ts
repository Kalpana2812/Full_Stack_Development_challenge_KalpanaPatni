import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

function storageRoot() {
  const configured = process.env.LOCAL_ARTWORK_STORAGE_PATH;
  if (!configured) return null;
  return resolve(configured);
}

function safePath(root: string, key: string) {
  const cleanKey = key.replace(/^\/+/, "");
  const destination = resolve(root, cleanKey);
  if (!cleanKey || (destination !== root && !destination.startsWith(`${root}${sep}`))) {
    throw new Error("Invalid local storage key.");
  }
  return { key: cleanKey, destination };
}

export function localArtworkStorageEnabled() {
  return Boolean(storageRoot());
}

export async function putLocalArtwork(key: string, content: Buffer) {
  const root = storageRoot();
  if (!root) throw new Error("Local artwork storage is not configured.");
  const target = safePath(root, key);
  await mkdir(dirname(target.destination), { recursive: true });
  await writeFile(target.destination, content);
  return { key: target.key, url: `/local-storage/${target.key}` };
}

export async function readLocalArtwork(key: string) {
  const root = storageRoot();
  if (!root) throw new Error("Local artwork storage is not configured.");
  const target = safePath(root, key);
  return { key: target.key, content: await readFile(target.destination) };
}
