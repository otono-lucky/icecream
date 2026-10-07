import { MAX_UPLOAD_BYTES } from "../../../contracts";

import { ApiError } from "./errors";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/** Reads and validates one image field from a multipart form. */
export function requireImage(form: FormData, field: string): File {
  const value = form.get(field);
  if (!(value instanceof File)) {
    throw new ApiError(400, "invalid_request", `${field}: an image file is required.`);
  }
  if (!IMAGE_TYPES.has(value.type)) {
    throw new ApiError(415, "unsupported_media_type", "Upload a JPEG, PNG, WebP or HEIC image.");
  }
  if (value.size === 0 || value.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(413, "file_too_large", "Images must be under 10 MB.");
  }
  return value;
}

export async function readForm(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new ApiError(400, "invalid_request", "Expected a multipart form upload.");
  }
}

export async function storeImage(bucket: R2Bucket, key: string, file: File): Promise<void> {
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
}

export async function serveObject(bucket: R2Bucket, key: string): Promise<Response> {
  const object = await bucket.get(key);
  if (!object) {
    throw new ApiError(404, "not_found", "Not found.");
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=300",
    },
  });
}
