import { formatPrice } from "./format";

/**
 * A stand-in for the payment provider's hosted checkout, for development and testing only.
 * Shows the plan and price with Pay and Cancel buttons, then sends the member back to the app.
 */
export function fakeCheckoutPage(options: { reference: string; planLabel: string; amountNaira: number; returnUrl: string }) {
  const { reference, planLabel, amountNaira, returnUrl } = options;
  const escape = (value: string) =>
    value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
  const action = `/v1/billing/fake-checkout/${encodeURIComponent(reference)}`;
  const returnParam = `return=${encodeURIComponent(returnUrl)}`;

  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test checkout</title></head>
<body style="margin:0;padding:24px;background:#FAF8F5;font-family:Helvetica,Arial,sans-serif;color:#1F1B18">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
    <div style="display:inline-block;background:#FEF3C7;color:#B45309;font-weight:700;font-size:12px;padding:4px 10px;border-radius:99px">TEST CHECKOUT · NO REAL MONEY</div>
    <h1 style="font-size:22px;margin:16px 0 4px">icecream messaging</h1>
    <p style="color:#5F5751;margin:0 0 20px">${escape(planLabel)} plan</p>
    <div style="font-size:32px;font-weight:700;margin-bottom:24px">${escape(formatPrice(amountNaira))}</div>
    <form method="post" action="${action}/pay?${returnParam}">
      <button style="width:100%;height:52px;border:0;border-radius:12px;background:#9E3D48;color:#fff;font-size:16px;font-weight:700">Pay ${escape(formatPrice(amountNaira))} (test)</button>
    </form>
    <form method="post" action="${action}/cancel?${returnParam}" style="margin-top:10px">
      <button style="width:100%;height:48px;border:0;border-radius:12px;background:#F1ECE6;color:#1F1B18;font-size:15px;font-weight:600">Cancel</button>
    </form>
    <p style="color:#A39A92;font-size:12px;margin-top:20px">This page stands in for Paystack while the real connection isn't set up.</p>
  </div>
</body></html>`;
}

/**
 * Shown after Pay or Cancel. Android browsers won't follow an automatic redirect into an app
 * (exp:// or icecream://), so the page offers a button to tap instead. Closing the page also works:
 * the app checks the payment as soon as the browser closes.
 */
export function fakeCheckoutDonePage(options: { paid: boolean; backUrl: string }) {
  const { paid, backUrl } = options;
  const href = backUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${paid ? "Payment complete" : "Payment cancelled"}</title></head>
<body style="margin:0;padding:24px;background:#FAF8F5;font-family:Helvetica,Arial,sans-serif;color:#1F1B18">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;text-align:center">
    <div style="font-size:40px">${paid ? "✓" : "–"}</div>
    <h1 style="font-size:22px;margin:8px 0">${paid ? "Payment complete" : "Payment cancelled"}</h1>
    <p style="color:#5F5751;margin:0 0 24px">${paid ? "You can start messaging now." : "You haven’t been charged."}</p>
    <a href="${href}" style="display:block;height:52px;line-height:52px;border-radius:12px;background:#9E3D48;color:#fff;font-size:16px;font-weight:700;text-decoration:none">Return to icecream</a>
    <p style="color:#A39A92;font-size:13px;margin-top:16px">Or close this page to go back to the app.</p>
  </div>
</body></html>`;
}
