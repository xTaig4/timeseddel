/** Dagens dato som YYYY-MM-DD i lokal tid (ikke UTC). */
export function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 'HH:MM' → minutter fra midnat, eller null hvis ugyldig. */
export function parseHHMM(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutter fra midnat → 'HH:MM'. */
export function toHHMM(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Flekssaldo i minutter → '+2:36' / '−1:15' / '0:00'. */
export function formatFlex(minutes: number): string {
  const sign = minutes > 0 ? '+' : minutes < 0 ? '−' : '';
  const abs = Math.abs(minutes);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

/** Feriedage med dansk decimalkomma: 10.4 → '10,40'. */
export function formatDays(days: number): string {
  return days.toFixed(2).replace('.', ',');
}

/** 'YYYY-MM-DD' → 'DD/MM'. */
export function formatShortDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}
