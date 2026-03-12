'use client'

import * as React from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'

type FormSubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingText: string;
};

export function FormSubmitButton({ children, disabled, pendingText, ...props }: FormSubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button disabled={pending || disabled} {...props}>
      {pending ? pendingText : children}
    </Button>
  )
}
