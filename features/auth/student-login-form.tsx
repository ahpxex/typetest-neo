'use client'

import { useActionState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthFormState } from '@/features/auth/actions'
import { studentLoginAction } from '@/features/auth/actions'
import { FormSubmitButton } from '@/features/auth/form-submit-button'

const initialState: AuthFormState = {}

export function StudentLoginForm() {
  const [state, formAction] = useActionState(studentLoginAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="campusEmail">校园邮箱</Label>
        <Input
          id="campusEmail"
          name="campusEmail"
          type="email"
          autoComplete="email"
          placeholder="请输入你的校园邮箱"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="请输入登录密码"
          required
        />
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertTitle>登录失败</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <FormSubmitButton type="submit" className="w-full" pendingText="登录中...">
        使用邮箱登录
      </FormSubmitButton>
    </form>
  )
}
