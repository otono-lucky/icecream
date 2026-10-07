import { describe, expect, it } from "vitest";

import { DAILY_INTRODUCTION_LIMIT, type MemberCard, type TodayResponse } from "../../contracts";

import { activeMember, call, expectError, signUpToLiveness } from "./helpers";

const uniqueCity = () => `Testville ${Math.random().toString(36).slice(2, 8)}`;

async function today(token: string): Promise<MemberCard[]> {
  const response = await call("/v1/discovery/today", { token });
  expect(response.status).toBe(200);
  return ((await response.json()) as TodayResponse).introductions;
}

describe("today's introductions", () => {
  it("is only for verified members", async () => {
    const token = await signUpToLiveness();
    await expectError(await call("/v1/discovery/today", { token }), 403, "not_verified");
    await expectError(await call("/v1/discovery/today"), 401, "unauthorized");
  });

  it("shows a man a few verified women with photos, the same set all day", async () => {
    const city = uniqueCity();
    await activeMember({ firstName: "Ifeoma", gender: "woman", city });
    await activeMember({ firstName: "Ronke", gender: "woman", city });
    const man = await activeMember({ firstName: "Segun", gender: "man", city });

    const first = await today(man.token);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(DAILY_INTRODUCTION_LIMIT);
    for (const card of first) {
      expect(card.id).not.toBe(man.id);
      expect(card.photoIds.length).toBeGreaterThan(0);
      expect(card.badges).toContain("photo");
      expect(card.age).toBeGreaterThanOrEqual(35);
    }
    // Every card is a woman the man is allowed to see.
    for (const card of first) expect((await call(`/v1/members/${card.id}`, { token: man.token })).status).toBe(200);

    expect((await today(man.token)).map((card) => card.id)).toEqual(first.map((card) => card.id));
  });
});

describe("member profiles and photos", () => {
  it("lets a man see a verified woman and her photos, and says why she was suggested", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Adaeze", gender: "woman", city });
    const man = await activeMember({ firstName: "Kunle", gender: "man", city });

    const response = await call(`/v1/members/${woman.id}`, { token: man.token });
    expect(response.status).toBe(200);
    const card = (await response.json()) as MemberCard;
    expect(card.firstName).toBe("Adaeze");
    expect(card.reason).toContain(`Also in ${city}`);
    expect(card.photoIds).toHaveLength(2);

    const photo = await call(`/v1/members/${woman.id}/photos/${card.photoIds[0]}`, { token: man.token });
    expect(photo.status).toBe(200);
    expect(photo.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("hides people you shouldn't see: the same gender, and anyone not yet verified", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Bisi", gender: "woman", city });
    const otherWoman = await activeMember({ firstName: "Tola", gender: "woman", city });
    const man = await activeMember({ firstName: "Dayo", gender: "man", city });

    await expectError(await call(`/v1/members/${otherWoman.id}`, { token: woman.token }), 404, "not_found");
    const card = (await (await call(`/v1/members/${woman.id}`, { token: man.token })).json()) as MemberCard;
    await expectError(
      await call(`/v1/members/${woman.id}/photos/${card.photoIds[0]}`, { token: otherWoman.token }),
      404,
      "not_found",
    );

    // Still onboarding: not visible to anyone.
    const pendingToken = await signUpToLiveness();
    const pendingId = ((await (await call("/v1/me", { token: pendingToken })).json()) as { user: { id: string } }).user.id;
    await expectError(await call(`/v1/members/${pendingId}`, { token: man.token }), 404, "not_found");
  });
});
