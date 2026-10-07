import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { codeFor, issueOtp } from "../src/features/auth/otp";
import { ApiError } from "../src/lib/errors";

import { newEmail } from "./helpers";

describe("email delivery over SMTP", () => {
  it("refuses to run with missing SMTP settings", async () => {
    const incomplete = { ...env, EMAIL_PROVIDER: "smtp", SMTP_USER: "", SMTP_PASSWORD: "" };
    await expect(issueOtp(incomplete, newEmail())).rejects.toThrow("EMAIL_PROVIDER=smtp needs");
  });

  it("reports a clear error when the mail server can't be reached, and stores no code", async () => {
    const address = newEmail();
    const unreachable = {
      ...env,
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1",
      SMTP_USER: "user",
      SMTP_PASSWORD: "password",
      EMAIL_FROM_ADDRESS: "codes@example.com",
    };

    const error = await issueOtp(unreachable, address).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("email_failed");

    const stored = await env.DB.prepare("SELECT COUNT(*) AS count FROM otp_challenges WHERE destination = ?")
      .bind(address)
      .first<{ count: number }>();
    expect(stored?.count).toBe(0);

    // No cooldown was started, so a retry once email works goes straight through.
    await expect(issueOtp(env, address)).resolves.toBeUndefined();
  });
});

describe("which sign-in codes are fixed", () => {
  it("uses the fixed code only for codes printed to the log, never for emails really sent", () => {
    expect(codeFor({ ...env, EMAIL_PROVIDER: "console" })).toBe("123456");

    const sent = Array.from({ length: 5 }, () => codeFor({ ...env, EMAIL_PROVIDER: "smtp" }));
    expect(sent.every((code) => /^\d{6}$/.test(code))).toBe(true);
    expect(sent.some((code) => code !== "123456")).toBe(true);
    expect(new Set(sent).size).toBeGreaterThan(1);
  });

  it("never uses the fixed code in production", () => {
    expect(codeFor({ ...env, ENVIRONMENT: "production", EMAIL_PROVIDER: "console" })).not.toBe("123456");
  });
});
