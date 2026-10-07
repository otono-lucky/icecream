import { describe, expect, it } from "vitest";

import type { ChatResponse, ConversationsResponse, Message } from "../../contracts";

import { activeMember, call, expectError, imageForm } from "./helpers";

const uniqueCity = () => `Testville ${Math.random().toString(36).slice(2, 8)}`;

async function pairOfMembers() {
  const city = uniqueCity();
  const woman = await activeMember({ firstName: "Nneka", gender: "woman", city });
  const man = await activeMember({ firstName: "Kunle", gender: "man", city });
  return { woman, man };
}

const sendText = async (token: string, memberId: string, body: string, replyToId?: string) =>
  (await (await call(`/v1/chats/${memberId}/messages`, { token, json: { body, replyToId } })).json()) as Message;

const chat = async (token: string, memberId: string) =>
  (await (await call(`/v1/chats/${memberId}`, { token })).json()) as ChatResponse;

describe("photo messages", () => {
  it("sends a photo with a caption that only the two members can load", async () => {
    const { woman, man } = await pairOfMembers();
    const outsider = await activeMember({ firstName: "Ola", gender: "man", city: uniqueCity() });

    const response = await call(`/v1/chats/${man.id}/photos`, { token: woman.token, form: imageForm("photo", { caption: "At the beach" }) });
    expect(response.status).toBe(201);
    const photo = (await response.json()) as Message;
    expect(photo).toMatchObject({ kind: "photo", body: "At the beach", photo: { blurred: false } });

    const image = await call(`/v1/chats/${woman.id}/photos/${photo.id}`, { token: man.token });
    expect(image.status).toBe(200);
    expect(image.headers.get("Content-Type")).toBe("image/jpeg");
    await expectError(await call(`/v1/chats/${woman.id}/photos/${photo.id}`, { token: outsider.token }), 404, "not_found");
  });

  it("blurs photos from someone you haven't replied to yet", async () => {
    const { woman, man } = await pairOfMembers();
    await call(`/v1/chats/${man.id}/photos`, { token: woman.token, form: imageForm("photo") });
    expect((await chat(man.token, woman.id)).messages[0].photo).toEqual({ blurred: true });

    await sendText(woman.token, man.id, "Hope you like it"); // her own messages don't unblur for him
    expect((await chat(man.token, woman.id)).messages[0].photo).toEqual({ blurred: true });
    expect((await chat(woman.token, man.id)).messages[0].photo).toEqual({ blurred: false });
  });

  it("needs a plan to send photos, like text", async () => {
    const { woman, man } = await pairOfMembers();
    await expectError(await call(`/v1/chats/${woman.id}/photos`, { token: man.token, form: imageForm("photo") }), 402, "subscription_required");
    await expectError(
      await call(`/v1/chats/${man.id}/photos`, { token: woman.token, form: imageForm("photo", {}, "application/pdf") }),
      415,
      "unsupported_media_type",
    );
  });
});

describe("replies, reactions, deleting and seen", () => {
  it("quotes the message being replied to, and only within the same chat", async () => {
    const { woman, man } = await pairOfMembers();
    const first = await sendText(woman.token, man.id, "Do you like jollof?");
    const reply = await sendText(woman.token, man.id, "Asking for a friend", first.id);
    expect(reply.replyTo).toMatchObject({ id: first.id, fromMe: true, kind: "text", text: "Do you like jollof?" });

    const other = await pairOfMembers();
    const elsewhere = await sendText(other.woman.token, other.man.id, "Different chat");
    await expectError(
      await call(`/v1/chats/${man.id}/messages`, { token: woman.token, json: { body: "Hi", replyToId: elsewhere.id } }),
      400,
      "invalid_request",
    );
  });

  it("adds, replaces and removes a reaction", async () => {
    const { woman, man } = await pairOfMembers();
    const message = await sendText(woman.token, man.id, "Good morning");
    const react = (emoji: string | null) =>
      call(`/v1/chats/${man.id}/messages/${message.id}/reaction`, { method: "PUT", token: woman.token, json: { emoji } });

    expect((await react("❤️")).status).toBe(204);
    expect((await react("😂")).status).toBe(204);
    expect((await chat(woman.token, man.id)).messages[0].reactions).toEqual([{ emoji: "😂", fromMe: true }]);
    expect((await chat(man.token, woman.id)).messages[0].reactions).toEqual([{ emoji: "😂", fromMe: false }]);
    expect((await react(null)).status).toBe(204);
    expect((await chat(woman.token, man.id)).messages[0].reactions).toEqual([]);
    await expectError(await react("🍆"), 400, "invalid_request");
  });

  it("deletes your own message for everyone, leaving a placeholder", async () => {
    const { woman, man } = await pairOfMembers();
    const photo = (await (await call(`/v1/chats/${man.id}/photos`, { token: woman.token, form: imageForm("photo") })).json()) as Message;
    const text = await sendText(woman.token, man.id, "Oops, wrong chat");

    await expectError(await call(`/v1/chats/${woman.id}/messages/${text.id}`, { method: "DELETE", token: man.token }), 403, "not_allowed");
    expect((await call(`/v1/chats/${man.id}/messages/${text.id}`, { method: "DELETE", token: woman.token })).status).toBe(204);
    expect((await call(`/v1/chats/${man.id}/messages/${photo.id}`, { method: "DELETE", token: woman.token })).status).toBe(204);

    const his = await chat(man.token, woman.id);
    expect(his.messages.map((m) => [m.kind, m.body])).toEqual([
      ["deleted", ""],
      ["deleted", ""],
    ]);
    await expectError(await call(`/v1/chats/${woman.id}/photos/${photo.id}`, { token: man.token }), 404, "not_found");
    const list = (await (await call("/v1/chats", { token: man.token })).json()) as ConversationsResponse;
    expect(list.conversations[0].lastMessage).toMatchObject({ kind: "deleted", text: "Message deleted" });
  });

  it("reports when the other member last opened the chat (for Seen)", async () => {
    const { woman, man } = await pairOfMembers();
    const message = await sendText(woman.token, man.id, "Hello");
    expect((await chat(woman.token, man.id)).theirLastReadAt).toBeNull();
    await chat(man.token, woman.id);
    expect((await chat(woman.token, man.id)).theirLastReadAt).toBeGreaterThanOrEqual(message.sentAt);
  });

  it("shows photos as a camera preview in the conversation list", async () => {
    const { woman, man } = await pairOfMembers();
    await call(`/v1/chats/${man.id}/photos`, { token: woman.token, form: imageForm("photo", { caption: "Sunday lunch" }) });
    const list = (await (await call("/v1/chats", { token: man.token })).json()) as ConversationsResponse;
    expect(list.conversations[0].lastMessage).toMatchObject({ kind: "photo", text: "📷 Sunday lunch", fromMe: false });
  });
});
