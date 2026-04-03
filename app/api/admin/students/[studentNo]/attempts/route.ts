import { NextResponse } from 'next/server'

import { canViewStudentAttempts } from '@/lib/auth/admin-authorization'
import { getCurrentAdmin } from '@/lib/auth/session'
import { getAdminStudentAttemptSummaries } from '@/lib/data/queries'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentNo: string }> },
) {
  const currentAdmin = await getCurrentAdmin()

  if (!currentAdmin) {
    return NextResponse.json({ error: '管理员未登录。' }, { status: 401 })
  }

  if (!canViewStudentAttempts(currentAdmin.admin.role)) {
    return NextResponse.json({ error: '当前账号没有查看成绩详情的权限。' }, { status: 403 })
  }

  const { studentNo } = await params
  const normalizedStudentNo = decodeURIComponent(studentNo).trim()

  if (!normalizedStudentNo) {
    return NextResponse.json({ error: '学号不合法。' }, { status: 400 })
  }

  const attempts = await getAdminStudentAttemptSummaries(normalizedStudentNo)

  return NextResponse.json({
    attempts: attempts.map((attempt) => ({
      ...attempt,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
    })),
  }, {
    headers: {
      'Cache-Control': 'private, no-store',
    },
  })
}
