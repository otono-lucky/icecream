import { PLANS, WOMEN_FREE_AT_LAUNCH, type BillingStatus, type PlanId } from "../../../../contracts";

type SubscriptionRow = { plan: PlanId; status: "active" | "cancelled"; current_period_end: number };

/** The one rule for "may this member send messages?" (PRD 1.4: payment is the gate to speak). */
export async function billingStatus(db: D1Database, userId: string, now = Date.now()): Promise<BillingStatus> {
  const [users, subs] = await db.batch([
    db.prepare("SELECT gender FROM users WHERE id = ?").bind(userId),
    db.prepare("SELECT plan, status, current_period_end FROM subscriptions WHERE user_id = ?").bind(userId),
  ]);
  const gender = (users.results[0] as { gender: string | null } | undefined)?.gender;
  const sub = subs.results[0] as SubscriptionRow | undefined;
  const subscription = sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.current_period_end } : null;

  if (WOMEN_FREE_AT_LAUNCH && gender === "woman") return { canMessage: true, why: "free_at_launch", subscription };
  const live = Boolean(sub && sub.current_period_end > now);
  return { canMessage: live, why: live ? "subscribed" : "none", subscription };
}

/** Starts or extends a subscription after a successful payment. Extends from the end of a live period. */
export function activateSubscription(db: D1Database, userId: string, plan: PlanId, provider: string, now = Date.now()) {
  const periodMs = PLANS[plan].days * 24 * 60 * 60 * 1000;
  return db
    .prepare(
      `INSERT INTO subscriptions (user_id, plan, status, current_period_end, provider, updated_at)
       VALUES (?1, ?2, 'active', ?3 + ?4, ?5, ?3)
       ON CONFLICT (user_id) DO UPDATE SET
         plan = excluded.plan,
         status = 'active',
         current_period_end = MAX(subscriptions.current_period_end, ?3) + ?4,
         provider = excluded.provider,
         updated_at = ?3`,
    )
    .bind(userId, plan, now, periodMs, provider);
}
