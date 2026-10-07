import { describe, expect, it } from "vitest";

import {
  call,
  decide,
  expectError,
  expectMe,
  imageForm,
  pendingVerifications,
  signIn,
  signUpToLiveness,
} from "./helpers";

describe("age gate", () => {
  it("declines anyone under 35 and locks the date so it can't be retried", async () => {
    const { token } = await signIn();
    const me = await expectMe(await call("/v1/me/date-of-birth", { method: "PUT", token, json: { dateOfBirth: "2000-01-01" } }));
    expect(me.user.status).toBe("ineligible");
    expect(me.onboarding.nextStep).toBe("ineligible");

    await expectError(
      await call("/v1/me/date-of-birth", { method: "PUT", token, json: { dateOfBirth: "1980-01-01" } }),
      409,
      "already_set",
    );
    await expectError(
      await call("/v1/me/details", { method: "PUT", token, json: { firstName: "A", gender: "man", city: "Lagos" } }),
      403,
      "not_allowed",
    );
  });

  it("rejects impossible dates", async () => {
    const { token } = await signIn();
    await expectError(
      await call("/v1/me/date-of-birth", { method: "PUT", token, json: { dateOfBirth: "1980-02-30" } }),
      400,
      "invalid_date",
    );
  });
});

describe("basic details and photos", () => {
  it("validates details", async () => {
    const { token } = await signIn();
    await call("/v1/me/date-of-birth", { method: "PUT", token, json: { dateOfBirth: "1975-03-03" } });
    await expectError(
      await call("/v1/me/details", { method: "PUT", token, json: { firstName: " ", gender: "other", city: "Lagos" } }),
      400,
      "invalid_request",
    );
  });

  it("only accepts images, and not before the details step", async () => {
    const { token } = await signIn();
    await expectError(await call("/v1/me/photos", { token, form: imageForm("photo") }), 409, "step_out_of_order");

    await call("/v1/me/date-of-birth", { method: "PUT", token, json: { dateOfBirth: "1975-03-03" } });
    await call("/v1/me/details", { method: "PUT", token, json: { firstName: "Tunde", gender: "man", city: "Abuja" } });
    await expectError(await call("/v1/me/photos", { token, form: imageForm("photo", {}, "application/pdf") }), 415, "unsupported_media_type");

    const me = await expectMe(await call("/v1/me/photos", { token, form: imageForm("photo") }), 201);
    expect(me.photos).toHaveLength(1);
    expect(me.onboarding.nextStep).toBe("photos");

    const image = await call(`/v1/me/photos/${me.photos[0].id}`, { token });
    expect(image.headers.get("Content-Type")).toBe("image/jpeg");

    const afterDelete = await expectMe(await call(`/v1/me/photos/${me.photos[0].id}`, { method: "DELETE", token }));
    expect(afterDelete.photos).toHaveLength(0);
  });

  it("won't take a liveness check before photos are in", async () => {
    const { token } = await signIn();
    await expectError(await call("/v1/verification/liveness", { token, form: imageForm("selfie") }), 409, "step_out_of_order");
  });
});

describe("verification", () => {
  it("runs the whole flow: liveness, skip ID, pending, approval makes the member active", async () => {
    const token = await signUpToLiveness();

    let me = await expectMe(await call("/v1/verification/liveness", { token, form: imageForm("selfie") }), 201);
    expect(me.verification.liveness.state).toBe("pending");
    expect(me.onboarding.nextStep).toBe("id-verification");

    me = await expectMe(await call("/v1/verification/government-id/skip", { method: "POST", token }));
    expect(me.verification.governmentId.state).toBe("skipped");
    expect(me.onboarding.nextStep).toBe("pending");

    const item = (await pendingVerifications()).find((v) => v.member.id === me.user.id && v.kind === "liveness");
    expect(item).toBeDefined();
    expect((await decide(item!.id, { decision: "pass" })).status).toBe(204);

    me = await expectMe(await call("/v1/me", { token }));
    expect(me.user.status).toBe("active");
    expect(me.verification.liveness.state).toBe("passed");
    expect(me.onboarding.nextStep).toBe("done");
  });

  it("sends a failed liveness check back to the member with the reason, and lets them retry", async () => {
    const token = await signUpToLiveness();
    const me = await expectMe(await call("/v1/verification/liveness", { token, form: imageForm("selfie") }), 201);
    await expectError(await call("/v1/verification/liveness", { token, form: imageForm("selfie") }), 409, "step_out_of_order");

    const item = (await pendingVerifications()).find((v) => v.member.id === me.user.id)!;
    expect((await decide(item.id, { decision: "fail", reason: "Selfie was too dark." })).status).toBe(204);

    const after = await expectMe(await call("/v1/me", { token }));
    expect(after.user.status).toBe("onboarding");
    expect(after.onboarding.nextStep).toBe("liveness");
    expect(after.verification.liveness.failureReason).toBe("Selfie was too dark.");
    await expectMe(await call("/v1/verification/liveness", { token, form: imageForm("selfie") }), 201);
  });

  it("accepts an optional government ID and doesn't take it twice", async () => {
    const token = await signUpToLiveness();
    await call("/v1/verification/liveness", { token, form: imageForm("selfie") });
    await expectError(
      await call("/v1/verification/government-id", { token, form: imageForm("document", { documentType: "bvn" }) }),
      400,
      "invalid_request",
    );

    const me = await expectMe(
      await call("/v1/verification/government-id", { token, form: imageForm("document", { documentType: "nin" }) }),
      201,
    );
    expect(me.verification.governmentId.state).toBe("pending");
    expect(me.onboarding.nextStep).toBe("pending");
    await expectError(
      await call("/v1/verification/government-id", { token, form: imageForm("document", { documentType: "nin" }) }),
      409,
      "already_submitted",
    );
  });

  it("keeps the admin API behind an admin sign-in", async () => {
    await expectError(await call("/v1/admin/checks"), 401, "unauthorized");
    // A member's session is not an admin session.
    const { token } = await signIn();
    await expectError(await call("/v1/admin/checks", { token }), 401, "unauthorized");
  });

  it("requires a reason to fail a check, and decides each check only once", async () => {
    const token = await signUpToLiveness();
    const me = await expectMe(await call("/v1/verification/liveness", { token, form: imageForm("selfie") }), 201);
    const item = (await pendingVerifications()).find((v) => v.member.id === me.user.id)!;

    await expectError(await decide(item.id, { decision: "fail", reason: "" }), 400, "invalid_request");
    expect((await decide(item.id, { decision: "pass" })).status).toBe(204);
    await expectError(await decide(item.id, { decision: "pass" }), 409, "already_decided");
  });
});

describe("changing photos", () => {
  async function memberWithPhotos(count: number) {
    const { token } = await signIn();
    await call("/v1/me/date-of-birth", { method: "PUT", token, json: { dateOfBirth: "1978-06-01" } });
    await call("/v1/me/details", { method: "PUT", token, json: { firstName: "Kemi", gender: "woman", city: "Lagos" } });
    let me = await expectMe(await call("/v1/me", { token }));
    for (let i = 0; i < count; i++) me = await expectMe(await call("/v1/me/photos", { token, form: imageForm("photo") }), 201);
    return { token, me };
  }

  it("reorders photos, so any photo can become the main one", async () => {
    const { token, me } = await memberWithPhotos(3);
    const [a, b, c] = me.photos.map((photo) => photo.id);

    const after = await expectMe(await call("/v1/me/photos/order", { method: "PUT", token, json: { photoIds: [c, a, b] } }));
    expect(after.photos.map((photo) => photo.id)).toEqual([c, a, b]);
    expect(after.photos.map((photo) => photo.position)).toEqual([1, 2, 3]);
  });

  it("rejects an order that leaves out, repeats or invents a photo", async () => {
    const { token, me } = await memberWithPhotos(2);
    const [a, b] = me.photos.map((photo) => photo.id);
    for (const photoIds of [[a], [a, a], [a, "someone-elses-photo"], [a, b, b]]) {
      await expectError(await call("/v1/me/photos/order", { method: "PUT", token, json: { photoIds } }), 400, "invalid_request");
    }
  });

  it("replaces a photo in the same place, with a new id", async () => {
    const { token, me } = await memberWithPhotos(3);
    const [a, b, c] = me.photos.map((photo) => photo.id);

    const after = await expectMe(await call(`/v1/me/photos/${b}/replace`, { token, form: imageForm("photo", {}, "image/png") }));
    expect(after.photos).toHaveLength(3);
    expect(after.photos[0].id).toBe(a);
    expect(after.photos[2].id).toBe(c);
    expect(after.photos[1].id).not.toBe(b);
    expect((await call(`/v1/me/photos/${after.photos[1].id}`, { token })).headers.get("Content-Type")).toBe("image/png");
    await expectError(await call(`/v1/me/photos/${b}`, { token }), 404, "not_found");
  });

  it("won't replace another member's photo, or with a non-image", async () => {
    const owner = await memberWithPhotos(1);
    const other = await memberWithPhotos(1);
    await expectError(
      await call(`/v1/me/photos/${owner.me.photos[0].id}/replace`, { token: other.token, form: imageForm("photo") }),
      404,
      "not_found",
    );
    await expectError(
      await call(`/v1/me/photos/${owner.me.photos[0].id}/replace`, {
        token: owner.token,
        form: imageForm("photo", {}, "application/pdf"),
      }),
      415,
      "unsupported_media_type",
    );
  });
});
