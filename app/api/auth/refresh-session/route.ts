import { NextResponse } from 'next/server'
import { z } from 'zod'

import { isTrustedSameOriginRequest } from '@/lib/auth/request-security'
import { clearSession, refreshSession } from '@/lib/auth/session'

const refreshSessionSchema = z.object({
  userType: z.enum(['student', 'admin']),
})

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest({
    host: request.headers.get('host'),
    forwardedHost: request.headers.get('x-forwarded-host'),
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
  })) {
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 })
  }

  const json = await request.json().catch(() => null)
  const parsed = refreshSessionSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_session_refresh_request' }, { status: 400 })
  }

  const refreshed = await refreshSession(parsed.data.userType)

  if (!refreshed) {
    await clearSession(parsed.data.userType)
    return NextResponse.json({ error: 'session_expired' }, { status: 401 })
  }

  return new NextResponse(null, { status: 204 })
}
