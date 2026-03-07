import { NextResponse } from 'next/server'

import { getCurrentAdmin } from '@/lib/auth/session'
import { getAdminStudentAttemptSummaries } from '@/lib/data/queries'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const currentAdmin = await getCurrentAdmin()

  if (!currentAdmin) {
    return NextResponse.json({ error: '管理员未登录。' }, { status: 401 })
  }

  const { studentId } = await params
  const id = Number(studentId)

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: '学生 ID 不合法。' }, { status: 400 })
  }

  const attempts = await getAdminStudentAttemptSummaries(id)

  return NextResponse.json({
    attempts: attempts.map((attempt) => ({
      ...attempt,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
    })),
  })
}
