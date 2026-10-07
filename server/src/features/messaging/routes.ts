import { z } from "zod";

import {
  ageOn,
  MAX_MESSAGE_LENGTH,
  REACTIONS,
  todayUtc,
  type ChatMember,
  type ChatResponse,
  type ConversationsResponse,
  type Message,
  type MessageKind,
  type MessagePreview,
  type Reaction,
} from "../../../../contracts";
import { createRouter } from "../../lib/app";
import { randomId } from "../../lib/crypto";
import { ApiError } from "../../lib/errors";
import { readForm, requireImage, serveObject, storeImage } from "../../lib/media";
import { parseJson } from "../../lib/validation";
import { requireSession } from "../auth/sessions";
import { billingStatus } from "../billing/entitlement";
import { requireActive, VISIBLE_MEMBER, visibleBinds, type Viewer } from "../discovery/visibility";

type MemberRow = { id: string; first_name: string; date_of_birth: string; city: string; main_photo_id: string | null };

const MEMBER_COLUMNS = `u.id, u.first_name, u.date_of_birth, u.city,
  (SELECT p.id FROM photos p WHERE p.user_id = u.id ORDER BY p.position LIMIT 1) AS main_photo_id`;

const MAX_CAPTION_LENGTH = 500;

const toChatMember = (row: MemberRow): ChatMember => ({
  id: row.id,
  firstName: row.first_name,
  age: ageOn(row.date_of_birth, todayUtc()),
  city: row.city,
  mainPhotoId: row.main_photo_id,
});

/** Conversations are stored once per pair, smaller id first. */
const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]);

function previewText(kind: MessageKind, body: string): string {
  if (kind === "deleted") return "Message deleted";
  if (kind === "photo") return body ? `📷 ${body}` : "📷 Photo";
  return body.length > 80 ? `${body.slice(0, 80)}…` : body;
}

const kindOf = (row: { kind: "text" | "photo"; deleted_at: number | null }): MessageKind =>
  row.deleted_at ? "deleted" : row.kind;

async function visibleMember(db: D1Database, viewer: Viewer, memberId: string): Promise<MemberRow> {
  const row = await db
    .prepare(`SELECT ${MEMBER_COLUMNS} FROM users u WHERE u.id = ? AND ${VISIBLE_MEMBER}`)
    .bind(memberId, ...visibleBinds(viewer))
    .first<MemberRow>();
  if (!row) throw new ApiError(404, "not_found", "This profile is no longer available.");
  return row;
}

async function conversationId(db: D1Database, viewer: Viewer, memberId: string): Promise<string | null> {
  const [a, b] = pair(viewer.id, memberId);
  const row = await db
    .prepare("SELECT id FROM conversations WHERE member_a = ? AND member_b = ?")
    .bind(a, b)
    .first<{ id: string }>();
  return row?.id ?? null;
}

async function ensureConversation(db: D1Database, viewer: Viewer, memberId: string, now: number): Promise<string> {
  const [a, b] = pair(viewer.id, memberId);
  await db
    .prepare(
      `INSERT INTO conversations (id, member_a, member_b, created_at, last_message_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (member_a, member_b) DO UPDATE SET last_message_at = excluded.last_message_at`,
    )
    .bind(randomId(), a, b, now, now)
    .run();
  return (await conversationId(db, viewer, memberId))!;
}

type MessageRow = {
  id: string;
  sender_id: string;
  kind: "text" | "photo";
  body: string;
  created_at: number;
  deleted_at: number | null;
  r_id: string | null;
  r_sender: string | null;
  r_kind: "text" | "photo" | null;
  r_body: string | null;
  r_deleted: number | null;
};

const MESSAGE_SELECT = `SELECT m.id, m.sender_id, m.kind, m.body, m.created_at, m.deleted_at,
    r.id AS r_id, r.sender_id AS r_sender, r.kind AS r_kind, r.body AS r_body, r.deleted_at AS r_deleted
  FROM messages m LEFT JOIN messages r ON r.id = m.reply_to_id`;

/** Every message in a conversation, as the viewer sees it. */
async function loadMessages(db: D1Database, conversation: string, viewer: Viewer): Promise<Message[]> {
  const [messages, reactions] = await db.batch([
    db.prepare(`${MESSAGE_SELECT} WHERE m.conversation_id = ? ORDER BY m.created_at, m.rowid LIMIT 500`).bind(conversation),
    db
      .prepare(
        `SELECT mr.message_id, mr.user_id, mr.emoji FROM message_reactions mr
         JOIN messages m ON m.id = mr.message_id WHERE m.conversation_id = ? ORDER BY mr.created_at`,
      )
      .bind(conversation),
  ]);
  const rows = messages.results as MessageRow[];
  const reactionRows = reactions.results as { message_id: string; user_id: string; emoji: Reaction }[];
  // Photos from the other member stay blurred until the viewer has replied at least once.
  const viewerHasReplied = rows.some((row) => row.sender_id === viewer.id);
  return rows.map((row) => toMessage(row, viewer, reactionRows, viewerHasReplied));
}

function toMessage(
  row: MessageRow,
  viewer: Viewer,
  reactions: { message_id: string; user_id: string; emoji: Reaction }[],
  viewerHasReplied: boolean,
): Message {
  const kind = kindOf(row);
  const fromMe = row.sender_id === viewer.id;
  const replyKind = row.r_kind ? kindOf({ kind: row.r_kind, deleted_at: row.r_deleted }) : null;
  return {
    id: row.id,
    fromMe,
    kind,
    body: kind === "deleted" ? "" : row.body,
    sentAt: row.created_at,
    replyTo:
      row.r_id && replyKind
        ? { id: row.r_id, fromMe: row.r_sender === viewer.id, kind: replyKind, text: previewText(replyKind, row.r_body ?? "") }
        : null,
    reactions: kind === "deleted"
      ? []
      : reactions
          .filter((reaction) => reaction.message_id === row.id)
          .map((reaction) => ({ emoji: reaction.emoji, fromMe: reaction.user_id === viewer.id })),
    photo: kind === "photo" ? { blurred: !fromMe && !viewerHasReplied } : null,
  };
}

async function requireCanMessage(db: D1Database, viewer: Viewer) {
  if (!(await billingStatus(db, viewer.id)).canMessage) {
    throw new ApiError(402, "subscription_required", "Choose a plan to start messaging.");
  }
}

/** A reply must point at a message in the same conversation. */
async function checkReplyTarget(db: D1Database, conversation: string | null, replyToId: string | undefined) {
  if (!replyToId) return null;
  const target = conversation
    ? await db.prepare("SELECT id FROM messages WHERE id = ? AND conversation_id = ?").bind(replyToId, conversation).first()
    : null;
  if (!target) throw new ApiError(400, "invalid_request", "You can only reply to a message in this conversation.");
  return replyToId;
}

async function insertMessage(
  db: D1Database,
  viewer: Viewer,
  conversation: string,
  message: { id: string; kind: "text" | "photo"; body: string; objectKey: string | null; replyToId: string | null; now: number },
): Promise<Message> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO messages (id, conversation_id, sender_id, kind, body, object_key, reply_to_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(message.id, conversation, viewer.id, message.kind, message.body, message.objectKey, message.replyToId, message.now),
    // Your own message counts as read up to now.
    db
      .prepare(
        `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at) VALUES (?, ?, ?)
         ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = excluded.last_read_at`,
      )
      .bind(conversation, viewer.id, message.now),
  ]);
  const row = await db.prepare(`${MESSAGE_SELECT} WHERE m.id = ?`).bind(message.id).first<MessageRow>();
  return toMessage(row!, viewer, [], true);
}

/** The message, if it's in the viewer's conversation with this member. */
async function messageInChat(db: D1Database, viewer: Viewer, memberId: string, messageId: string) {
  const conversation = await conversationId(db, viewer, memberId);
  const row = conversation
    ? await db
        .prepare("SELECT id, sender_id, kind, object_key, deleted_at FROM messages WHERE id = ? AND conversation_id = ?")
        .bind(messageId, conversation)
        .first<{ id: string; sender_id: string; kind: "text" | "photo"; object_key: string | null; deleted_at: number | null }>()
    : null;
  if (!row) throw new ApiError(404, "not_found", "Message not found.");
  return row;
}

/**
 * Chat between verified members of the other gender (PRD 3.4). Anyone visible can be messaged,
 * with or without interest first. Reading is always free; sending, reacting and photos need
 * messaging access. Conversations are keyed by the other member's id.
 */
export const chatRoutes = createRouter()
  .use(requireSession)
  .use(requireActive)

  .get("/", async (c) => {
    const viewer = c.get("viewer");
    const { results } = await c.env.DB.prepare(
      `SELECT ${MEMBER_COLUMNS},
              m.id AS message_id, m.sender_id, m.kind, m.body, m.created_at, m.deleted_at,
              (SELECT COUNT(*) FROM messages unread
               WHERE unread.conversation_id = c.id AND unread.sender_id != ?
                 AND unread.created_at > COALESCE((SELECT r.last_read_at FROM conversation_reads r
                                                   WHERE r.conversation_id = c.id AND r.user_id = ?), 0)) AS unread
       FROM conversations c
       JOIN users u ON u.id = CASE WHEN c.member_a = ? THEN c.member_b ELSE c.member_a END
       JOIN messages m ON m.id = (SELECT id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC, rowid DESC LIMIT 1)
       WHERE (c.member_a = ? OR c.member_b = ?) AND ${VISIBLE_MEMBER}
       ORDER BY c.last_message_at DESC LIMIT 100`,
    )
      .bind(viewer.id, viewer.id, viewer.id, viewer.id, viewer.id, ...visibleBinds(viewer))
      .all<
        MemberRow & {
          message_id: string;
          sender_id: string;
          kind: "text" | "photo";
          body: string;
          created_at: number;
          deleted_at: number | null;
          unread: number;
        }
      >();

    return c.json<ConversationsResponse>({
      conversations: results.map((row) => {
        const kind = kindOf(row);
        const last: MessagePreview & { sentAt: number } = {
          id: row.message_id,
          fromMe: row.sender_id === viewer.id,
          kind,
          text: previewText(kind, row.body),
          sentAt: row.created_at,
        };
        return { member: toChatMember(row), lastMessage: last, unread: row.unread };
      }),
    });
  })

  /** The conversation with one member, oldest first. Opening it marks it read. */
  .get("/:memberId", async (c) => {
    const viewer = c.get("viewer");
    const member = await visibleMember(c.env.DB, viewer, c.req.param("memberId"));
    const conversation = await conversationId(c.env.DB, viewer, member.id);

    let messages: Message[] = [];
    let theirLastReadAt: number | null = null;
    if (conversation) {
      messages = await loadMessages(c.env.DB, conversation, viewer);
      const [, theirs] = await c.env.DB.batch([
        c.env.DB.prepare(
          `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at) VALUES (?, ?, ?)
           ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = excluded.last_read_at`,
        ).bind(conversation, viewer.id, Date.now()),
        c.env.DB.prepare("SELECT last_read_at FROM conversation_reads WHERE conversation_id = ? AND user_id = ?").bind(
          conversation,
          member.id,
        ),
      ]);
      theirLastReadAt = (theirs.results[0] as { last_read_at: number } | undefined)?.last_read_at ?? null;
    }

    const { canMessage } = await billingStatus(c.env.DB, viewer.id);
    return c.json<ChatResponse>({ member: toChatMember(member), messages, canSend: canMessage, theirLastReadAt });
  })

  .post("/:memberId/messages", async (c) => {
    const viewer = c.get("viewer");
    const member = await visibleMember(c.env.DB, viewer, c.req.param("memberId"));
    const body = await parseJson(
      c,
      z.object({ body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH), replyToId: z.string().optional() }),
    );
    await requireCanMessage(c.env.DB, viewer);
    const replyToId = await checkReplyTarget(c.env.DB, await conversationId(c.env.DB, viewer, member.id), body.replyToId);

    const now = Date.now();
    const conversation = await ensureConversation(c.env.DB, viewer, member.id, now);
    const message = await insertMessage(c.env.DB, viewer, conversation, {
      id: randomId(),
      kind: "text",
      body: body.body,
      objectKey: null,
      replyToId,
      now,
    });
    return c.json<Message>(message, 201);
  })

  /** A photo message: multipart with "photo", and optional "caption" and "replyToId". */
  .post("/:memberId/photos", async (c) => {
    const viewer = c.get("viewer");
    const member = await visibleMember(c.env.DB, viewer, c.req.param("memberId"));
    await requireCanMessage(c.env.DB, viewer);
    const form = await readForm(c.req.raw);
    const file = requireImage(form, "photo");
    const caption = String(form.get("caption") ?? "").trim();
    if (caption.length > MAX_CAPTION_LENGTH) {
      throw new ApiError(400, "invalid_request", `Captions can be up to ${MAX_CAPTION_LENGTH} characters.`);
    }
    const replyField = form.get("replyToId");
    const replyToId = await checkReplyTarget(
      c.env.DB,
      await conversationId(c.env.DB, viewer, member.id),
      typeof replyField === "string" && replyField ? replyField : undefined,
    );

    const now = Date.now();
    const conversation = await ensureConversation(c.env.DB, viewer, member.id, now);
    const id = randomId();
    const objectKey = `chats/${conversation}/${id}`;
    await storeImage(c.env.MEDIA, objectKey, file);
    const message = await insertMessage(c.env.DB, viewer, conversation, {
      id,
      kind: "photo",
      body: caption,
      objectKey,
      replyToId,
      now,
    });
    return c.json<Message>(message, 201);
  })

  /** A photo from this chat. Only the two members can load it. */
  .get("/:memberId/photos/:messageId", async (c) => {
    const viewer = c.get("viewer");
    await visibleMember(c.env.DB, viewer, c.req.param("memberId"));
    const message = await messageInChat(c.env.DB, viewer, c.req.param("memberId"), c.req.param("messageId"));
    if (message.kind !== "photo" || message.deleted_at || !message.object_key) {
      throw new ApiError(404, "not_found", "Photo not found.");
    }
    return serveObject(c.env.MEDIA, message.object_key);
  })

  /** React to a message, or pass null to remove your reaction. One reaction per member per message. */
  .put("/:memberId/messages/:messageId/reaction", async (c) => {
    const viewer = c.get("viewer");
    await visibleMember(c.env.DB, viewer, c.req.param("memberId"));
    const { emoji } = await parseJson(c, z.object({ emoji: z.enum(REACTIONS).nullable() }));
    await requireCanMessage(c.env.DB, viewer);
    const message = await messageInChat(c.env.DB, viewer, c.req.param("memberId"), c.req.param("messageId"));
    if (message.deleted_at) throw new ApiError(409, "message_deleted", "This message was deleted.");

    if (emoji) {
      await c.env.DB.prepare(
        `INSERT INTO message_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at`,
      )
        .bind(message.id, viewer.id, emoji, Date.now())
        .run();
    } else {
      await c.env.DB.prepare("DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?").bind(message.id, viewer.id).run();
    }
    return c.body(null, 204);
  })

  /** Delete your own message for everyone. The text and any photo are wiped; a placeholder remains. */
  .delete("/:memberId/messages/:messageId", async (c) => {
    const viewer = c.get("viewer");
    const message = await messageInChat(c.env.DB, viewer, c.req.param("memberId"), c.req.param("messageId"));
    if (message.sender_id !== viewer.id) throw new ApiError(403, "not_allowed", "You can only delete your own messages.");
    if (message.deleted_at) return c.body(null, 204);

    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE messages SET deleted_at = ?, body = '', object_key = NULL WHERE id = ?").bind(Date.now(), message.id),
      c.env.DB.prepare("DELETE FROM message_reactions WHERE message_id = ?").bind(message.id),
    ]);
    if (message.object_key) await c.env.MEDIA.delete(message.object_key);
    return c.body(null, 204);
  });
