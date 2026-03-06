export function formatDateTime(date?: Date | number | null) {
  if (!date) {
    return '—';
  }

  const value = date instanceof Date ? date : new Date(date);

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatKpm(value: number) {
  return `${value.toFixed(0)} KPM`;
}

export function formatDurationSeconds(value: number) {
  const total = Math.max(0, Math.round(value));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');

  return `${minutes}:${seconds}`;
}

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
