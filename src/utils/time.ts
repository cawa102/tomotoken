export function currentMonthString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function daysBetween(earliest: string, latest: string): number {
  const e = new Date(earliest).getTime();
  const l = new Date(latest).getTime();
  if (Number.isNaN(e) || Number.isNaN(l)) {
    return 1;
  }
  const diffMs = Math.abs(l - e);
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

export function hoursAgo(isoString: string, now: Date = new Date()): number {
  const then = new Date(isoString).getTime();
  return (now.getTime() - then) / (60 * 60 * 1000);
}
