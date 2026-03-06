type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<BadgeTone, string> = {
  default: 'bg-zinc-100 text-zinc-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-sky-100 text-sky-700',
};

export function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
