import { cors } from "hono/cors";

import { adminAuthRoutes } from "./features/admin/auth";
import { emailLinkRoutes, processOutbox } from "./features/admin/emails";
import { adminRoutes } from "./features/admin/routes";
import { authRoutes } from "./features/auth/routes";
import { billingMemberRoutes, billingRoutes } from "./features/billing/routes";
import { discoveryRoutes, interestRoutes, memberRoutes } from "./features/discovery/routes";
import { meRoutes } from "./features/me/routes";
import { profileRoutes } from "./features/profile/routes";
import { chatRoutes } from "./features/messaging/routes";
import { safetyRoutes } from "./features/safety/routes";
import { verificationRoutes } from "./features/verification/routes";
import { createRouter } from "./lib/app";
import { ApiError } from "./lib/errors";

const app = createRouter();

// Only the web build needs CORS; native apps don't send an Origin.
app.use("*", async (c, next) =>
  cors({ origin: c.env.CORS_ORIGINS.split(",").filter(Boolean), allowHeaders: ["Authorization", "Content-Type"] })(c, next),
);

app.get("/health", (c) => c.json({ ok: true }));
app.route("/v1/auth", authRoutes);
app.route("/v1/me/profile", profileRoutes);
app.route("/v1/me", meRoutes);
app.route("/v1/verification", verificationRoutes);
app.route("/v1/discovery", discoveryRoutes);
app.route("/v1/members", memberRoutes);
app.route("/v1/interests", interestRoutes);
app.route("/v1/members", safetyRoutes);
app.route("/v1/chats", chatRoutes);
// Public test checkout pages first, then the member billing routes (which require a session).
app.route("/v1/billing", billingRoutes);
app.route("/v1/billing", billingMemberRoutes);
// Admin sign-in first: everything else under /v1/admin needs a signed-in admin.
app.route("/v1/admin/auth", adminAuthRoutes);
app.route("/v1/admin", adminRoutes);
// Public: the unsubscribe link in announcement emails.
app.route("/v1/email", emailLinkRoutes);

app.notFound((c) => c.json(new ApiError(404, "not_found", "Not found.").toBody(), 404));
app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json(error.toBody(), error.status);
  }
  console.error(error);
  return c.json(new ApiError(500, "internal_error", "Something went wrong.").toBody(), 500);
});

export default {
  fetch: app.fetch,
  // Every minute (wrangler.jsonc "triggers"): send the next few queued bulk emails.
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(processOutbox(env).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
