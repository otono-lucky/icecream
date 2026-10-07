import type { GovernmentIdDocumentType, Me, SetBasicDetailsBody } from "@contracts";
import type { ImagePickerAsset } from "expo-image-picker";

import { apiRequest } from "@/shared/lib/apiClient";
import { appendImage } from "@/shared/lib/upload";

export const setDateOfBirth = (dateOfBirth: string) =>
  apiRequest<Me>("/v1/me/date-of-birth", { method: "PUT", json: { dateOfBirth } });

export const setBasicDetails = (details: SetBasicDetailsBody) =>
  apiRequest<Me>("/v1/me/details", { method: "PUT", json: details });

export async function uploadPhoto(asset: ImagePickerAsset): Promise<Me> {
  const form = new FormData();
  await appendImage(form, "photo", asset);
  return apiRequest<Me>("/v1/me/photos", { form });
}

export const deletePhoto = (photoId: string) => apiRequest<Me>(`/v1/me/photos/${photoId}`, { method: "DELETE" });

export async function replacePhoto(photoId: string, asset: ImagePickerAsset): Promise<Me> {
  const form = new FormData();
  await appendImage(form, "photo", asset);
  return apiRequest<Me>(`/v1/me/photos/${photoId}/replace`, { form });
}

/** Every photo id in the new order; the first becomes the main photo. */
export const reorderPhotos = (photoIds: string[]) =>
  apiRequest<Me>("/v1/me/photos/order", { method: "PUT", json: { photoIds } });

export async function submitLivenessSelfie(asset: ImagePickerAsset): Promise<Me> {
  const form = new FormData();
  await appendImage(form, "selfie", asset);
  return apiRequest<Me>("/v1/verification/liveness", { form });
}

export async function submitGovernmentId(documentType: GovernmentIdDocumentType, asset: ImagePickerAsset): Promise<Me> {
  const form = new FormData();
  form.append("documentType", documentType);
  await appendImage(form, "document", asset);
  return apiRequest<Me>("/v1/verification/government-id", { form });
}

export const skipGovernmentId = () => apiRequest<Me>("/v1/verification/government-id/skip", { method: "POST" });
