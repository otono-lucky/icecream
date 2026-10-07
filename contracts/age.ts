export const MIN_AGE = 35;

/** Age in whole years on `today`. Dates are YYYY-MM-DD, compared as calendar dates with no timezone shift. */
export function ageOn(dateOfBirth: string, today: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const hadBirthdayThisYear = tm > bm || (tm === bm && td >= bd);
  return ty - by - (hadBirthdayThisYear ? 0 : 1);
}

/** True for a real calendar date in strict YYYY-MM-DD form that isn't after `today`. */
export function isValidDateOfBirth(value: string, today: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isRealDate && year >= 1900 && value <= today;
}

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
