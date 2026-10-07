import { PLANS } from "@contracts";

import { useAsync } from "@/shared/lib/useAsync";
import { AppText, Card, Screen } from "@/shared/ui";

import { getReceipts } from "../api/billingApi";
import { formatDate, formatNaira } from "../format";

export function PaymentHistoryScreen() {
  const receipts = useAsync(getReceipts, []);
  const list = receipts.data?.receipts ?? [];

  return (
    <Screen title="Payment history">
      {receipts.status === "success" && list.length === 0 ? (
        <AppText tone="muted" className="text-[15px]">
          No payments yet.
        </AppText>
      ) : null}
      {list.map((receipt) => (
        <Card key={receipt.reference}>
          <AppText weight="bold" className="text-base">
            Messaging, {PLANS[receipt.plan].label.toLowerCase()}
          </AppText>
          <AppText tone="muted" className="text-sm">
            {formatDate(receipt.paidAt)} · {formatNaira(receipt.amountNaira)}
          </AppText>
          <AppText tone="faint" className="text-xs">
            Reference {receipt.reference}
          </AppText>
        </Card>
      ))}
    </Screen>
  );
}
