'use client'

import { useEffect, useRef } from 'react'

import { verifyStudentEmailAction } from '@/features/auth/actions'
import { FormSubmitButton } from '@/features/auth/form-submit-button'

export function VerifyEmailTokenForm({ token }: { token: string }) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    formRef.current?.requestSubmit()
  }, [])

  return (
    <form ref={formRef} action={verifyStudentEmailAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm leading-7 text-muted-foreground">
        正在自动确认你的校园邮箱。如果页面没有自动跳转，请点击下面的按钮继续。
      </p>
      <FormSubmitButton type="submit" className="w-full" pendingText="正在确认...">
        继续确认邮箱
      </FormSubmitButton>
    </form>
  )
}
