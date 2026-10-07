import { emailLayout, sendEmail } from "../../lib/mailer";

import { OTP_TTL_MS } from "./otp";

const subject = "Your icecream sign-in code";

// Deliberately plain: no mention of dating, since members may read this on a shared or visible screen.
function renderCode(code: string) {
  const minutes = OTP_TTL_MS / 60_000;
  const text = [
    `Your icecream sign-in code is ${code}`,
    "",
    `It expires in ${minutes} minutes. Never share this code with anyone, including people who say they work for icecream.`,
    "",
    "If you didn't ask for this code, you can ignore this email.",
  ].join("\n");

  const html = emailLayout(`
    <p style="font-size:17px;line-height:24px;margin:24px 0 8px">Your sign-in code is</p>
    <div style="font-size:36px;font-weight:700;letter-spacing:8px;margin:0 0 24px">${code}</div>
    <p style="font-size:15px;line-height:22px;color:#5F5751;margin:0 0 12px">
      It expires in ${minutes} minutes. Never share this code with anyone, including people who say they work for icecream.
    </p>
    <p style="font-size:13px;line-height:20px;color:#A39A92;margin:0">If you didn't ask for this code, you can ignore this email.</p>`);

  return { text, html };
}

/** Emails a sign-in code. */
export async function sendOtpEmail(env: Env, email: string, code: string): Promise<void> {
  await sendEmail(env, { to: email, subject, ...renderCode(code) });
}
