'use client';

import { useActionState } from 'react';

import type { AuthFormState } from '@/features/auth/actions';
import { adminLoginAction } from '@/features/auth/actions';
import { isDevelopment } from '@/lib/env';
import { SubmitButton } from '@/components/ui/submit-button';

const initialState: AuthFormState = {};

export function AdminLoginForm() {
  const [state, formAction] = useActionState(adminLoginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="space-y-2 text-sm font-medium text-zinc-700">
        <span>管理员账号</span>
        <input
          type="text"
          name="username"
          placeholder="请输入管理员账号"
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
          required
        />
      </label>

      <label className="space-y-2 text-sm font-medium text-zinc-700">
        <span>管理员密码</span>
        <input
          type="password"
          name="password"
          placeholder="请输入管理员密码"
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
          required
        />
      </label>

      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}

      <SubmitButton className="w-full">进入后台</SubmitButton>

      {isDevelopment ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700">
          开发环境管理员：账号 `admin` / 密码 `admin123456`
        </div>
      ) : null}
    </form>
  );
}
