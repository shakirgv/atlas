"use client";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { BUCKETS, MAX_UPLOAD_BYTES } from "@/lib/config";
import type { PhotoMeta } from "@/lib/validation";
import type { PhotoEntityType } from "@/lib/types";

export type UploadProgress = { name: string; progress: number; status: "queued" | "processing" | "uploading" | "done" | "error"; error?: string };

const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

/** Read date taken + GPS from EXIF (before compression strips it). */
async function readExif(file: File) {
  try {
    const exifr = (await import("exifr")).default;
    const data = (await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"] })) as
      | { DateTimeOriginal?: Date; CreateDate?: Date; latitude?: number; longitude?: number }
      | undefined;
    const taken = data?.DateTimeOriginal ?? data?.CreateDate;
    return {
      taken_at: taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken.toISOString() : null,
      lat: typeof data?.latitude === "number" && Number.isFinite(data.latitude) ? data.latitude : null,
      lng: typeof data?.longitude === "number" && Number.isFinite(data.longitude) ? data.longitude : null,
    };
  } catch {
    return { taken_at: null, lat: null, lng: null };
  }
}

async function toJpegIfHeic(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  const heic2any = (await import("heic2any")).default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(out) ? out[0]! : out;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
}

async function dimensions(blob: Blob) {
  try {
    const bmp = await createImageBitmap(blob);
    const d = { width: bmp.width, height: bmp.height };
    bmp.close();
    return d;
  } catch {
    return { width: null, height: null };
  }
}

/** EXIF → HEIC convert → compress (1920px WebP + 480px thumb). */
export async function processImage(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 25 MB");
  const exif = await readExif(file);
  const source = await toJpegIfHeic(file);
  const full = await imageCompression(source, {
    maxWidthOrHeight: 1920,
    fileType: "image/webp",
    initialQuality: 0.82,
    maxSizeMB: 0.45,
    useWebWorker: true,
  });
  const thumb = await imageCompression(source, {
    maxWidthOrHeight: 480,
    fileType: "image/webp",
    initialQuality: 0.78,
    maxSizeMB: 0.08,
    useWebWorker: true,
  });
  const dims = await dimensions(full);
  return { full, thumb, exif, ...dims };
}

/**
 * Full manual-upload pipeline. Uploads up to 3 files in parallel with per-file progress.
 * Returns metadata for `savePhotos`.
 */
export async function uploadPhotos(
  userId: string,
  entityType: PhotoEntityType,
  entityId: string,
  files: File[],
  onProgress?: (index: number, p: UploadProgress) => void,
): Promise<PhotoMeta[]> {
  const supabase = createClient();
  const results: (PhotoMeta | null)[] = new Array(files.length).fill(null);
  let cursor = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const i = cursor++;
      const file = files[i]!;
      const report = (p: Partial<UploadProgress>) => onProgress?.(i, { name: file.name, progress: 0, status: "processing", ...p });
      try {
        report({ status: "processing", progress: 0.15 });
        const img = await processImage(file);
        report({ status: "uploading", progress: 0.55 });
        const id = crypto.randomUUID();
        const base = `${userId}/${entityType}/${entityId}/${id}`;
        const path = `${base}.webp`;
        const thumbPath = `${base}_thumb.webp`;
        const bucket = supabase.storage.from(BUCKETS.photos);
        const a = await bucket.upload(path, img.full, { contentType: "image/webp" });
        if (a.error) throw new Error(a.error.message);
        report({ status: "uploading", progress: 0.85 });
        const b = await bucket.upload(thumbPath, img.thumb, { contentType: "image/webp" });
        if (b.error) throw new Error(b.error.message);
        results[i] = { path, thumb_path: thumbPath, width: img.width, height: img.height, ...img.exif };
        report({ status: "done", progress: 1 });
      } catch (e) {
        report({ status: "error", progress: 1, error: e instanceof Error ? e.message : "Upload failed" });
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return results.filter((r): r is PhotoMeta => Boolean(r));
}

/** Upload an original document file to the private documents bucket. */
export async function uploadDocumentFile(userId: string, documentId: string, file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 25 MB");
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `${userId}/document/${documentId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKETS.documents).upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message);
  return { path, name: file.name, mime: file.type || "application/octet-stream", size: file.size };
}

export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.docx,application/pdf,image/jpeg,image/png,image/heic,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const IMAGE_ACCEPT = "image/*,.heic,.heif";
