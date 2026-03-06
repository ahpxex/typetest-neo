export function NoticeBanner({
  message,
  tone = 'success',
}: {
  message?: string;
  tone?: 'success' | 'error';
}) {
  if (!message) {
    return null;
  }

  const className =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-rose-200 bg-rose-50 text-rose-700';

  return <div className={`rounded-xl border px-4 py-3 text-sm ${className}`}>{message}</div>;
}
