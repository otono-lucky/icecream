import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { call, email, expectError, expectMe, FIXED_CODE, newEmail, signIn, signInWith } from "./helpers";

describe("email sign-up with a code", () => {
  it("rejects addresses that aren't email", async () => {
    await expectError(await call("/v1/auth/otp/request", { json: email("ada@") }), 400, "invalid_email");
  });

  it("creates a member on first verify, with an email and no phone, starting at the age gate", async () => {
    const address = newEmail();
    const { token, me } = await signInWith(email(`  ${address.toUpperCase()} `));
    expect(token.length).toBeGreaterThan(30);
    expect(me.user.email).toBe(address);
    expect(me.user.phone).toBeNull();
    expect(me.user.status).toBe("onboarding");
    expect(me.onboarding.nextStep).toBe("age-gate");
  });

  it("rejects a wrong code, pointing at the inbox, then accepts the right one", async () => {
    const address = newEmail();
    await call("/v1/auth/otp/request", { json: email(address) });
    const wrong = await call("/v1/auth/otp/verify", { json: email(address, "000000") });
    expect(wrong.status).toBe(400);
    expect(((await wrong.json()) as { error: { message: string } }).error.message).toContain("your email");
    expect((await call("/v1/auth/otp/verify", { json: email(address, FIXED_CODE) })).status).toBe(200);
  });

  it("does not accept the same code twice", async () => {
    const address = newEmail();
    await call("/v1/auth/otp/request", { json: email(address) });
    expect((await call("/v1/auth/otp/verify", { json: email(address, FIXED_CODE) })).status).toBe(200);
    await expectError(await call("/v1/auth/otp/verify", { json: email(address, FIXED_CODE) }), 400, "code_expired");
  });

  it("locks the code after five wrong attempts", async () => {
    const address = newEmail();
    await call("/v1/auth/otp/request", { json: email(address) });
    for (let i = 0; i < 5; i++) {
      await expectError(await call("/v1/auth/otp/verify", { json: email(address, "000000") }), 400, "invalid_code");
    }
    await expectError(await call("/v1/auth/otp/verify", { json: email(address, FIXED_CODE) }), 429, "too_many_attempts");
  });

  it("makes you wait before resending", async () => {
    const address = newEmail();
    expect((await call("/v1/auth/otp/request", { json: email(address) })).status).toBe(200);
    await expectError(await call("/v1/auth/otp/request", { json: email(address) }), 429, "resend_too_soon");
  });

  it("signs a returning member back into the same account, progress intact", async () => {
    const address = newEmail();
    const first = await signIn(address);
    await call("/v1/me/date-of-birth", { method: "PUT", token: first.token, json: { dateOfBirth: "1980-05-20" } });
    // Age the first code past the resend cooldown.
    await env.DB.prepare("UPDATE otp_challenges SET created_at = created_at - 120000 WHERE destination = ?")
      .bind(address)
      .run();

    const second = await signIn(address);
    expect(second.me.user.id).toBe(first.me.user.id);
    expect(second.me.onboarding.nextStep).toBe("basic-details");
  });

  it("requires a channel", async () => {
    await expectError(await call("/v1/auth/otp/request", { json: { to: newEmail() } }), 400, "invalid_request");
  });

  it("refuses phone sign-in, asking for an email instead", async () => {
    const phone = { channel: "sms", to: "08031234567" };
    await expectError(await call("/v1/auth/otp/request", { json: phone }), 400, "email_only");
    await expectError(await call("/v1/auth/otp/verify", { json: { ...phone, code: FIXED_CODE } }), 400, "email_only");
  });

  it("requires a session for /me, and sign-out ends it", async () => {
    await expectError(await call("/v1/me"), 401, "unauthorized");
    const { token } = await signIn();
    await expectMe(await call("/v1/me", { token }));
    expect((await call("/v1/auth/sign-out", { method: "POST", token })).status).toBe(204);
    await expectError(await call("/v1/me", { token }), 401, "unauthorized");
  });
});
