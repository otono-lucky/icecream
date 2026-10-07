export type PlanId = "weekly" | "monthly" | "yearly";

/** Messaging plans for men (PRD 1.5). Women message free at launch; the difference isn't advertised. */
export const PLANS: Record<PlanId, { label: string; priceNaira: number; per: string; days: number }> = {
  weekly: { label: "Weekly", priceNaira: 1_000, per: "week", days: 7 },
  monthly: { label: "Monthly", priceNaira: 5_000, per: "month", days: 30 },
  yearly: { label: "Yearly", priceNaira: 45_000, per: "year", days: 365 },
};

export const PLAN_ORDER: PlanId[] = ["weekly", "monthly", "yearly"];

/** PRD 6 open question: how long this lasts. One switch, server-side. */
export const WOMEN_FREE_AT_LAUNCH = true;

export type BillingStatus = {
  /** Whether this member may send messages right now. */
  canMessage: boolean;
  why: "free_at_launch" | "subscribed" | "none";
  subscription: {
    plan: PlanId;
    /** "cancelled" still works until currentPeriodEnd; it just won't renew. */
    status: "active" | "cancelled";
    currentPeriodEnd: number;
  } | null;
};

export type CheckoutBody = {
  plan: PlanId;
  /** Needed for the receipt when the member signed up with a phone number. */
  email?: string;
  /** Where the checkout page sends the member back to (the app's deep link). */
  returnUrl: string;
};
export type CheckoutResponse = { reference: string; checkoutUrl: string };

export type PaymentResult = { reference: string; status: "pending" | "paid" | "failed"; billing: BillingStatus };

export type Receipt = { reference: string; plan: PlanId; amountNaira: number; paidAt: number };
export type ReceiptsResponse = { receipts: Receipt[] };
