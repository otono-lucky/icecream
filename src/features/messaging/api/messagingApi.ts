import type { ChatResponse, ConversationsResponse, Message, Reaction } from "@contracts";
import type { ImagePickerAsset } from "expo-image-picker";

import { apiRequest } from "@/shared/lib/apiClient";
import { appendImage } from "@/shared/lib/upload";

export const getConversations = () => apiRequest<ConversationsResponse>("/v1/chats");

export const getChat = (memberId: string) => apiRequest<ChatResponse>(`/v1/chats/${memberId}`);

export const sendMessage = (memberId: string, body: string, replyToId?: string) =>
  apiRequest<Message>(`/v1/chats/${memberId}/messages`, { json: { body, replyToId } });

export async function sendPhoto(memberId: string, asset: ImagePickerAsset, replyToId?: string): Promise<Message> {
  const form = new FormData();
  await appendImage(form, "photo", asset);
  if (replyToId) form.append("replyToId", replyToId);
  return apiRequest<Message>(`/v1/chats/${memberId}/photos`, { form });
}

export const react = (memberId: string, messageId: string, emoji: Reaction | null) =>
  apiRequest<void>(`/v1/chats/${memberId}/messages/${messageId}/reaction`, { method: "PUT", json: { emoji } });

export const deleteMessage = (memberId: string, messageId: string) =>
  apiRequest<void>(`/v1/chats/${memberId}/messages/${messageId}`, { method: "DELETE" });
