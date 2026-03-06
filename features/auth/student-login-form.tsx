'use client';

import { useActionState } from 'react';

import type { AuthFormState } from '@/features/auth/actions';
import { studentLoginAction } from '@/features/auth/actions';
import { SubmitButton } from '@/components/ui/submit-button';

const initialState: AuthFormState = {};

export function StudentLoginForm() {
  const [state, formAction] = useActionState(studentLoginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="space-y-2 text-sm font-medium text-zinc-700">
        <span>学号</span>
        <input
          type="text"
          name="studentNo"
          placeholder="请输入学号"
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

      <SubmitButton className="w-full">登录学生端</SubmitButton>
    </form>
  );
}
