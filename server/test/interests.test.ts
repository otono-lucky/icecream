import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type { MemberCard, ReceivedInterestsResponse, TodayResponse } from "../../contracts";

import { activeMember, call, expectError, signUpToLiveness } from "./helpers";

const uniqueCity = () => `Testville ${Math.random().toString(36).slice(2, 8)}`;

const decide = (token: string, memberId: string, decision: string) =>
  call(`/v1/members/${memberId}/decision`, { method: "PUT", token, json: { decision } });

async function received(token: string): Promise<MemberCard[]> {
  const response = await call("/v1/interests/received", { token });
  expect(response.status).toBe(200);
  return ((await response.json()) as ReceivedInterestsResponse).interests;
}

describe("interest and pass", () => {
  it("tells her about his interest, and shows it on both sides", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Nkechi", gender: "woman", city });
    const man = await activeMember({ firstName: "Obinna", gender: "man", city });

    const response = await decide(man.token, woman.id, "interest");
    expect(response.status).toBe(200);
    expect(((await response.json()) as MemberCard).decision).toBe("interest");

    const herList = await received(woman.token);
    const him = herList.find((card) => card.id === man.id)!;
    expect(him.firstName).toBe("Obinna");
    expect(him.interestedInYou).toBe(true);
    expect(him.decision).toBeNull();
  });

  it("makes it mutual when she is interested too", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Uche", gender: "woman", city });
    const man = await activeMember({ firstName: "Femi", gender: "man", city });
    await decide(man.token, woman.id, "interest");
    await decide(woman.token, man.id, "interest");

    const him = (await received(woman.token)).find((card) => card.id === man.id)!;
    expect(him.decision).toBe("interest");
    expect(him.interestedInYou).toBe(true);
    const her = (await (await call(`/v1/members/${woman.id}`, { token: man.token })).json()) as MemberCard;
    expect(her.decision).toBe("interest");
    expect(her.interestedInYou).toBe(true);
  });

  it("never tells anyone about a pass, and a quiet 'not for me' removes him from her list", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Halima", gender: "woman", city });
    const man = await activeMember({ firstName: "Musa", gender: "man", city });

    await decide(woman.token, man.id, "pass");
    expect((await received(man.token)).some((card) => card.id === woman.id)).toBe(false);

    await decide(man.token, woman.id, "interest");
    // She already passed on him, so his interest doesn't show up for her.
    expect((await received(woman.token)).some((card) => card.id === man.id)).toBe(false);
  });

  it("lets a member change their mind", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Ijeoma", gender: "woman", city });
    const man = await activeMember({ firstName: "Tayo", gender: "man", city });
    await decide(man.token, woman.id, "pass");
    const changed = (await (await decide(man.token, woman.id, "interest")).json()) as MemberCard;
    expect(changed.decision).toBe("interest");
    expect((await received(woman.token)).some((card) => card.id === man.id)).toBe(true);
  });

  it("only works on members you can see, and only for verified members", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Amina", gender: "woman", city });
    const otherWoman = await activeMember({ firstName: "Zara", gender: "woman", city });
    await expectError(await decide(woman.token, otherWoman.id, "interest"), 404, "not_found");
    await expectError(await decide(woman.token, otherWoman.id, "like"), 400, "invalid_request");

    const pendingToken = await signUpToLiveness();
    await expectError(await decide(pendingToken, woman.id, "interest"), 403, "not_verified");
    await expectError(await call("/v1/interests/received", { token: pendingToken }), 403, "not_verified");
  });

  it("keeps today's set stable after a pass, and leaves passed people out on later days", async () => {
    const city = uniqueCity();
    await activeMember({ firstName: "Ebele", gender: "woman", city });
    const man = await activeMember({ firstName: "Kayode", gender: "man", city });

    const today = async () =>
      ((await (await call("/v1/discovery/today", { token: man.token })).json()) as TodayResponse).introductions;
    const first = await today();
    const passed = first[0];
    await decide(man.token, passed.id, "pass");

    const sameDay = await today();
    expect(sameDay.map((card) => card.id)).toContain(passed.id);
    expect(sameDay.find((card) => card.id === passed.id)!.decision).toBe("pass");

    // Pretend the pass happened yesterday.
    await env.DB.prepare("UPDATE decisions SET decided_at = decided_at - 86400000 WHERE to_user_id = ?")
      .bind(passed.id)
      .run();
    expect((await today()).map((card) => card.id)).not.toContain(passed.id);
  });
});
