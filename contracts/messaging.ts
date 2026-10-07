export type ChatMember = { id: string; firstName: string; age: number; city: string; mainPhotoId: string | null };

/** Reactions members can add to a message (long-press). */
export const REACTIONS = ["❤️", "👍", "😊", "😂", "😮", "🙏"] as const;
export type Reaction = (typeof REACTIONS)[number];

export type MessageKind = "text" | "photo" | "deleted";

/** A short stand-in for a message, used in reply quotes and the conversation list. */
export type MessagePreview = { id: string; fromMe: boolean; kind: MessageKind; text: string };

export type Message = {
  id: string;
  fromMe: boolean;
  kind: MessageKind;
  /** The text, or a photo's caption. Empty once deleted. */
  body: string;
  sentAt: number;
  replyTo: MessagePreview | null;
  reactions: { emoji: Reaction; fromMe: boolean }[];
  /**
   * Photo messages only. Photos from someone you haven't replied to yet arrive blurred
   * ("tap to view"), so an unwanted picture is never shown without a choice.
   */
  photo: { blurred: boolean } | null;
};

export type ConversationSummary = {
  member: ChatMember;
  lastMessage: MessagePreview & { sentAt: number };
  unread: number;
};
export type ConversationsResponse = { conversations: ConversationSummary[] };

export type ChatResponse = {
  member: ChatMember;
  /** Oldest first. */
  messages: Message[];
  /** False when the viewer needs a subscription to send. Reading is always free. */
  canSend: boolean;
  /** When the other member last opened this chat: your messages sent before this are "Seen". */
  theirLastReadAt: number | null;
};

export type SendMessageBody = { body: string; replyToId?: string };
export type ReactBody = { emoji: Reaction | null };
export const MAX_MESSAGE_LENGTH = 2000;

export type ReportReason = "fraud" | "misrepresentation" | "harassment" | "other";

/** The reasons as members choose them in the app, and as the safety team sees them on the admin website. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  fraud: "Asking for money or seems like a scam",
  misrepresentation: "Not who they say they are",
  harassment: "Harassment or disrespect",
  other: "Something else",
};
export type ReportBody = { reason: ReportReason; details?: string };
