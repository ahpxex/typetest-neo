'use client'

import { useActionState, useMemo, useState } from 'react'

import type { AuthFormState } from '@/features/auth/actions'
import { studentLoginAction } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildCampusEmail } from '@/lib/student-identity'

const initialState: AuthFormState = {}

export function StudentLoginForm() {
  const [state, formAction] = useActionState(studentLoginAction, initialState)
  const [studentNo, setStudentNo] = useState('')
  const campusEmail = useMemo(() => buildCampusEmail(studentNo), [studentNo])

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="studentNo">学号</Label>
        <Input
          id="studentNo"
          name="studentNo"
          placeholder="请输入 11 位学号"
          required
          value={studentNo}
          onChange={(event) => setStudentNo(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">姓名</Label>
        <Input id="name" name="name" placeholder="请输入姓名" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="campusEmail">校园邮箱</Label>
        <Input
          id="campusEmail"
          name="campusEmail"
          type="email"
          placeholder="学号输入后自动填写"
          required
          value={campusEmail}
          readOnly
        />
        <p className="text-xs text-muted-foreground">系统会根据学号自动识别校园邮箱。</p>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" className="w-full">登录学生端</Button>
    </form>
  )
}
