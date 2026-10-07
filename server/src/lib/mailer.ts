import { WorkerMailer } from "worker-mailer";

import { ApiError } from "./errors";

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
};

/**
 * Sends one email.
 * - "console": logs it (local development and tests only).
 * - "smtp": any SMTP server on port 465 (implicit TLS) or 587 (STARTTLS), e.g. Gmail with an app password.
 * Throws ApiError "email_failed" when the server can't be reached or refuses it.
 */
export async function sendEmail(env: Env, email: OutgoingEmail): Promise<void> {
  switch (env.EMAIL_PROVIDER) {
    case "console":
      if (env.ENVIRONMENT === "production") {
        throw new Error("EMAIL_PROVIDER=console must not be used in production.");
      }
      console.log(`[email] To ${email.to}: ${email.subject}\n${email.text}`);
      return;

    case "smtp": {
      if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.EMAIL_FROM_ADDRESS) {
        throw new Error("EMAIL_PROVIDER=smtp needs SMTP_HOST, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM_ADDRESS.");
      }
      const port = Number(env.SMTP_PORT);
      try {
        await WorkerMailer.send(
          {
            host: env.SMTP_HOST,
            port,
            secure: port === 465,
            startTls: port !== 465,
            credentials: { username: env.SMTP_USER, password: env.SMTP_PASSWORD },
            authType: ["plain", "login"],
            socketTimeoutMs: 10_000,
            responseTimeoutMs: 10_000,
          },
          {
            from: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM_ADDRESS },
            to: email.to,
            subject: email.subject,
            text: email.text,
            html: email.html,
            headers: email.headers,
          },
        );
      } catch (error) {
        console.error("[email] SMTP send failed", error);
        throw new ApiError(502, "email_failed", "We couldn't send the email just now. Please try again in a moment.");
      }
      return;
    }

    default:
      throw new Error(`Unknown EMAIL_PROVIDER "${env.EMAIL_PROVIDER}".`);
  }
}

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The icecream email frame: wordmark, a white card, and an optional small footer. `content` is HTML. */
export function emailLayout(content: string, footer?: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#FAF8F5;font-family:Helvetica,Arial,sans-serif;color:#1F1B18">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:32px">
    <div style="font-weight:800;font-size:18px;color:#9E3D48">icecream</div>
    ${content}
  </div>
  ${footer ? `<div style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:18px;color:#A39A92;text-align:center">${footer}</div>` : ""}
</body></html>`;
}
