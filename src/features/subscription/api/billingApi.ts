import type { BillingStatus, CheckoutBody, CheckoutResponse, PaymentResult, ReceiptsResponse } from "@contracts";

import { apiRequest } from "@/shared/lib/apiClient";

export const getBillingStatus = () => apiRequest<BillingStatus>("/v1/billing/status");

export const startCheckout = (body: CheckoutBody) => apiRequest<CheckoutResponse>("/v1/billing/checkout", { json: body });

export const verifyPayment = (reference: string) => apiRequest<PaymentResult>("/v1/billing/verify", { json: { reference } });

export const cancelSubscription = () => apiRequest<BillingStatus>("/v1/billing/cancel", { method: "POST" });

export const getReceipts = () => apiRequest<ReceiptsResponse>("/v1/billing/receipts");
