'use client';

import { useFormStatus } from 'react-dom';

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
};

export function SubmitButton({
  children,
  pendingLabel = '提交中…',
  className = '',
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={`inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
