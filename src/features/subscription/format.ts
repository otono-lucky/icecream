export const formatNaira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;

export const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
