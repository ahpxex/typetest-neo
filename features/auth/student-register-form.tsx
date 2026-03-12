'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthFormState } from '@/features/auth/actions'
import { studentRegisterAction } from '@/features/auth/actions'
import { FormSubmitButton } from '@/features/auth/form-submit-button'
import { buildCampusEmail } from '@/lib/student-identity'

const initialState: AuthFormState = {}

export function StudentRegisterForm() {
  const [state, formAction] = useActionState(studentRegisterAction, initialState)
  const [studentNo, setStudentNo] = useState('')
  const [campusEmail, setCampusEmail] = useState('')
  const suggestedCampusEmail = useMemo(() => buildCampusEmail(studentNo), [studentNo])

  function handleStudentNoChange(nextStudentNo: string) {
    const previousSuggestedEmail = buildCampusEmail(studentNo)
    const nextSuggestedEmail = buildCampusEmail(nextStudentNo)

    setStudentNo(nextStudentNo)
    setCampusEmail((currentValue) => {
      if (!currentValue || currentValue === previousSuggestedEmail) {
        return nextSuggestedEmail
      }

      return currentValue
    })
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="studentNo">学号</Label>
        <Input
          id="studentNo"
          name="studentNo"
          inputMode="numeric"
          placeholder="请输入 11 位学号"
          required
          value={studentNo}
          onChange={(event) => handleStudentNoChange(event.target.value)}
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
          autoComplete="email"
          placeholder="请输入校园邮箱"
          required
          value={campusEmail}
          onChange={(event) => setCampusEmail(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {suggestedCampusEmail
            ? `建议邮箱：${suggestedCampusEmail}`
            : '输入学号后，系统会给出对应的校园邮箱建议。'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">设置密码</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="至少 8 位"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="passwordConfirm">确认密码</Label>
          <Input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            placeholder="请再次输入密码"
            required
          />
        </div>
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertTitle>注册失败</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.success ? (
        <Alert>
          <AlertTitle>确认邮件已发送</AlertTitle>
          <AlertDescription>
            <p>{state.success}</p>
            <p>如果收件箱里暂时没有，请顺便检查垃圾邮件文件夹。</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <FormSubmitButton type="submit" className="w-full" pendingText="正在发送确认邮件...">
        注册并发送确认邮件
      </FormSubmitButton>

      <p className="text-sm text-muted-foreground">
        已经注册过？
        <Link href="/" className="ml-1 font-semibold text-foreground underline underline-offset-4">
          返回登录
        </Link>
      </p>
    </form>
  )
}
