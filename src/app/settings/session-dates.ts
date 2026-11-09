const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function formatSessionDate(date: Date): string {
  return dateFormat.format(date);
}

function dayNumber(date: Date): number {
  return Math.round(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

export function lastActiveLabel(date: Date, now: Date): string {
  const daysAgo = dayNumber(now) - dayNumber(date);
  if (daysAgo === 0) return "today";
  if (daysAgo === 1) return "yesterday";
  return formatSessionDate(date);
}
