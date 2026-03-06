'use client'

import { useActionState } from 'react'

import type { AuthFormState } from '@/features/auth/actions'
import { adminLoginAction } from '@/features/auth/actions'
import { isDevelopment } from '@/lib/env'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: AuthFormState = {}

export function AdminLoginForm() {
  const [state, formAction] = useActionState(adminLoginAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">管理员账号</Label>
        <Input id="username" name="username" placeholder="请输入管理员账号" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">管理员密码</Label>
        <Input id="password" name="password" type="password" placeholder="请输入管理员密码" required />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" className="w-full">进入后台</Button>

      {isDevelopment ? (
        <p className="text-xs text-muted-foreground">开发环境管理员：账号 `admin` / 密码 `admin123456`</p>
      ) : null}
    </form>
  )
}
