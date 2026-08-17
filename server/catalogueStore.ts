import { storagePut } from "./storage";

export interface StorageAdapter {
  put(key: string, content: Buffer, contentType: string): Promise<{ key: string; url: string }>;
}

export class S3StorageAdapter implements StorageAdapter {
  async put(key: string, content: Buffer, contentType: string) {
    return storagePut(key, content, contentType);
  }
}

/** Lightweight local adapter for deterministic development and tests. */
export class MemoryStorageAdapter implements StorageAdapter {
  readonly objects = new Map<string, { content: Buffer; contentType: string }>();

  async put(key: string, content: Buffer, contentType: string) {
    this.objects.set(key, { content: Buffer.from(content), contentType });
    return { key, url: `memory://${key}` };
  }
}

export function createStorageAdapter(backend: "s3" | "memory" = process.env.CATALOGUE_STORAGE_BACKEND === "memory" ? "memory" : "s3"): StorageAdapter {
  return backend === "memory" ? new MemoryStorageAdapter() : new S3StorageAdapter();
}

export async function writeCatalogueSnapshot(storage: StorageAdapter, version: string, payload: unknown) {
  const bytes = Buffer.from(JSON.stringify(payload));
  const temporaryKey = `catalogue/.tmp/${version}.json`;
  const temp = await storage.put(temporaryKey, bytes, "application/json");
  return { temporaryKey: temp.key, storageKey: temp.key, bytes };
}
