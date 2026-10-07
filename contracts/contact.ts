/** Lowercases and trims an email address; returns undefined if it isn't one. */
export function normalizeEmail(input: string): string | undefined {
  const email = input.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : undefined;
}
