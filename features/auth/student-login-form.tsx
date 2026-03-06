'use client';

import { useActionState } from 'react';

import type { AuthFormState } from '@/features/auth/actions';
import { studentLoginAction } from '@/features/auth/actions';
import { isDevelopment } from '@/lib/env';
import { SubmitButton } from '@/components/ui/submit-button';

const initialState: AuthFormState = {};

export function StudentLoginForm() {
  const [state, formAction] = useActionState(studentLoginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-zinc-700">
          <span>学号</span>
          <input
            type="text"
            name="studentNo"
            placeholder="例如 20260000001"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-900"
            required
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-zinc-700">
          <span>姓名</span>
          <input
            type="text"
            name="name"
            placeholder="请输入姓名"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
            required
          />
        </label>
      </div>

      <label className="space-y-2 text-sm font-medium text-zinc-700">
        <span>校园邮箱</span>
        <input
          type="email"
          name="campusEmail"
          placeholder="name@ucass.edu.cn"
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
          required
        />
      </label>

      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}

      <SubmitButton className="w-full">进入测试</SubmitButton>

      {isDevelopment ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700">
          开发环境测试账号：学号 `20260000001` / 姓名 `测试学生` / 邮箱 `student.dev@ucass.edu.cn`
        </div>
      ) : null}
    </form>
  );
}
