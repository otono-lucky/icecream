/** API paths for images, shared by every feature that shows a member's photos. */
export const memberPhotoPath = (memberId: string, photoId: string) => `/v1/members/${memberId}/photos/${photoId}`;

export const myPhotoPath = (photoId: string) => `/v1/me/photos/${photoId}`;

/** A photo sent in a chat; only the two members in the conversation can load it. */
export const chatPhotoPath = (memberId: string, messageId: string) => `/v1/chats/${memberId}/photos/${messageId}`;
