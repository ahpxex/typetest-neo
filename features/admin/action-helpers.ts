import { redirect } from 'next/navigation';

export function getRedirectTarget(formData: FormData, fallback: string) {
  const redirectTo = formData.get('redirectTo');
  return typeof redirectTo === 'string' && redirectTo.startsWith('/') ? redirectTo : fallback;
}

export function redirectWithNotice(path: string, key: 'success' | 'error', message: string): never {
  const target = new URL(path, 'http://localhost');
  target.searchParams.delete('success');
  target.searchParams.delete('error');
  target.searchParams.set(key, message);
  redirect(`${target.pathname}${target.search}`);
}

/**
 * Parses a value from an `<input type="datetime-local">`. The browser sends a
 * local wall-clock string with no timezone (e.g. `2026-05-27T14:30`); we treat
 * it as local time, which matches what the admin typed.
 */
export function parseOptionalDateTime(value: FormDataEntryValue | null): { ok: true; value: Date | null } | { ok: false } {
  if (value === null) {
    return { ok: true, value: null };
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false };
  }

  return { ok: true, value: parsed };
}
