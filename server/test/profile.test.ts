import { describe, expect, it } from "vitest";

import type { MemberCard, MyProfile, TodayResponse } from "../../contracts";

import { activeMember, call, expectError, publishProfile, signIn, signUpToLiveness } from "./helpers";

const uniqueCity = () => `Testville ${Math.random().toString(36).slice(2, 8)}`;
const put = (token: string, section: string, json: unknown) => call(`/v1/me/profile/${section}`, { method: "PUT", token, json });
const mine = async (token: string) => (await (await call("/v1/me/profile", { token })).json()) as MyProfile;

describe("building a profile", () => {
  it("saves each section and tracks which are done", async () => {
    const token = await signUpToLiveness(); // works during onboarding too
    expect((await mine(token)).sectionsDone).toEqual([]);

    expect((await put(token, "marital-history", { maritalStatus: "widowed" })).status).toBe(200);
    expect((await put(token, "faith", { faith: "muslim", faithPractice: "devout", partnerFaithImportance: "must_match" })).status).toBe(200);
    const profile = await mine(token);
    expect(profile.sectionsDone).toEqual(["marital-history", "faith"]);
    expect(profile.answers).toMatchObject({ maritalStatus: "widowed", faith: "muslim", faithPractice: "devout" });
    expect(profile.publishedAt).toBeNull();
  });

  it("needs the number of children and who they live with when there are children", async () => {
    const token = await signUpToLiveness();
    await expectError(await put(token, "children", { hasChildren: true, openToPartnerWithChildren: "yes" }), 400, "invalid_request");
    expect((await put(token, "children", { hasChildren: false, openToPartnerWithChildren: "maybe" })).status).toBe(200);
    expect((await mine(token)).answers).toMatchObject({ hasChildren: false, childrenCount: null, childrenLiveWith: null });
  });

  it("validates answers and text lengths", async () => {
    const token = await signUpToLiveness();
    await expectError(await put(token, "marital-history", { maritalStatus: "complicated" }), 400, "invalid_request");
    await expectError(await put(token, "work", { occupation: "", typicalWeek: "x" }), 400, "invalid_request");
    await expectError(await put(token, "looking-for", { lookingFor: "marriage", ownWords: "x".repeat(501) }), 400, "invalid_request");
    await expectError(await put(token, "hobbies", {}), 404, "not_found");
  });

  it("lets Where you live change the city given at sign-up", async () => {
    const { token } = await signIn();
    await call("/v1/me/date-of-birth", { method: "PUT", token, json: { dateOfBirth: "1979-01-01" } });
    await call("/v1/me/details", { method: "PUT", token, json: { firstName: "Bolu", gender: "woman", city: "Lagos" } });
    await put(token, "location", { city: "Abuja", relocate: "no" });
    expect(((await (await call("/v1/me", { token })).json()) as { user: { city: string } }).user.city).toBe("Abuja");
  });

  it("only publishes a complete profile", async () => {
    const token = await signUpToLiveness();
    await put(token, "marital-history", { maritalStatus: "divorced" });
    await expectError(await call("/v1/me/profile/publish", { method: "POST", token }), 409, "profile_incomplete");
    await publishProfile(token);
    expect((await mine(token)).publishedAt).not.toBeNull();
  });
});

describe("profiles in introductions", () => {
  it("introduces only members with a published profile, and shows their answers", async () => {
    const city = uniqueCity();
    const published = await activeMember({ firstName: "Sade", gender: "woman", city });
    const unpublished = await activeMember({ firstName: "Remi", gender: "woman", city }, { publish: false });
    const man = await activeMember({ firstName: "Tobi", gender: "man", city });

    const today = ((await (await call("/v1/discovery/today", { token: man.token })).json()) as TodayResponse).introductions;
    expect(today.some((card) => card.id === unpublished.id)).toBe(false);
    const sade = (await (await call(`/v1/members/${published.id}`, { token: man.token })).json()) as MemberCard;
    expect(sade.profile).toMatchObject({ maritalStatus: "divorced", faith: "christian", lookingFor: "marriage" });

    // An unpublished member can still be opened (e.g. from an old chat), just without profile details.
    const remi = (await (await call(`/v1/members/${unpublished.id}`, { token: man.token })).json()) as MemberCard;
    expect(remi.profile).toBeNull();
  });

  it("says what you have in common", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Ayo", gender: "woman", city }, { faith: "muslim", lookingFor: "marriage" });
    const man = await activeMember({ firstName: "Sule", gender: "man", city: uniqueCity() }, { faith: "muslim", lookingFor: "marriage" });
    const card = (await (await call(`/v1/members/${woman.id}`, { token: man.token })).json()) as MemberCard;
    expect(card.reason).toBe("Shares your faith · Also looking for marriage");
  });
});
