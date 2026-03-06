'use client'

import { useActionState } from 'react'

import type { AuthFormState } from '@/features/auth/actions'
import { studentLoginAction } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: AuthFormState = {}

export function StudentLoginForm() {
  const [state, formAction] = useActionState(studentLoginAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="studentNo">学号</Label>
        <Input id="studentNo" name="studentNo" placeholder="请输入学号" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">姓名</Label>
        <Input id="name" name="name" placeholder="请输入姓名" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="campusEmail">校园邮箱</Label>
        <Input id="campusEmail" name="campusEmail" type="email" placeholder="name@ucass.edu.cn" required />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" className="w-full">登录学生端</Button>
    </form>
  )
}
