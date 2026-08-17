export const ARTWORK_SPECS = {
  poster: { label: "Poster", ratio: 2 / 3, target: "600×900 px", minWidth: 560, minHeight: 840 },
  banner: { label: "Banner", ratio: 16 / 9, target: "1280×720 px", minWidth: 1200, minHeight: 675 },
  thumbnail: { label: "Thumbnail", ratio: 16 / 9, target: "640×360 px", minWidth: 600, minHeight: 338 },
} as const;

export type ArtworkKind = keyof typeof ARTWORK_SPECS;
export type ImageInfo = { width: number; height: number; mimeType: "image/png" | "image/jpeg" };

function readJpegInfo(data: Buffer): ImageInfo | null {
  let offset = 2;
  while (offset < data.length) {
    if (data[offset] !== 0xff) return null;
    const marker = data[offset + 1];
    const length = data.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7), mimeType: "image/jpeg" };
    }
    offset += 2 + length;
  }
  return null;
}

export function inspectImage(data: Buffer): ImageInfo | null {
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), mimeType: "image/png" };
  }
  if (data.length >= 10 && data[0] === 0xff && data[1] === 0xd8) return readJpegInfo(data);
  return null;
}

export function validateArtworkUpload(kind: ArtworkKind, data: Buffer): { ok: true; image: ImageInfo } | { ok: false; errors: string[] } {
  const spec = ARTWORK_SPECS[kind];
  const errors: string[] = [];
  if (data.byteLength > 200 * 1024) errors.push(`${spec.label} is ${Math.ceil(data.byteLength / 1024)} KB. Please upload a file smaller than 200 KB.`);
  const image = inspectImage(data);
  if (!image) return { ok: false, errors: [...errors, "Please upload a PNG or JPEG image so we can check its dimensions."] };
  const actualRatio = image.width / image.height;
  if (Math.abs(actualRatio - spec.ratio) > 0.02) errors.push(`${spec.label} needs a ${kind === "poster" ? "2:3" : "16:9"} shape. This image is ${image.width}×${image.height}; crop it before uploading.`);
  if (image.width < spec.minWidth || image.height < spec.minHeight) errors.push(`${spec.label} is too small at ${image.width}×${image.height}. Use approximately ${spec.target} or larger.`);
  return errors.length ? { ok: false, errors } : { ok: true, image };
}
