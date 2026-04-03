import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db, withDatabaseRetry } from '@/db/client';
import { attempts } from '@/db/schema';
import { getTrustedRequestIp, isTrustedSameOriginRequest } from '@/lib/auth/request-security';
import { getCurrentStudent } from '@/lib/auth/session';
import { getAttemptDetail } from '@/lib/data/queries';
import { calculateTypingMetrics, normalizeTypingText } from '@/modules/typing-engine';

const MAX_SUBMIT_PAYLOAD_BYTES = 64 * 1024;
const noStoreHeaders = {
  'Cache-Control': 'private, no-store',
};
const submitAttemptSchema = z.object({
  typedTextRaw: z.string().default(''),
  backspaceCount: z.number().int().min(0).max(100_000).default(0),
  clientMeta: z.object({
    language: z.string().trim().min(1).max(32).optional(),
    source: z.string().trim().min(1).max(64).optional(),
    viewport: z.object({
      width: z.number().int().min(0).max(20_000),
      height: z.number().int().min(0).max(20_000),
    }).optional(),
  }).strict().default({}),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  if (!isTrustedSameOriginRequest({
    host: request.headers.get('host'),
    forwardedHost: request.headers.get('x-forwarded-host'),
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
  })) {
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403, headers: noStoreHeaders });
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_SUBMIT_PAYLOAD_BYTES) {
    return NextResponse.json({ error: '提交内容过大。' }, { status: 413, headers: noStoreHeaders });
  }

  const currentStudent = await getCurrentStudent();

  if (!currentStudent) {
    return NextResponse.json({ error: '未登录或登录已失效。' }, { status: 401, headers: noStoreHeaders });
  }

  const { attemptId } = await params;
  const id = Number(attemptId);
  const attempt = await getAttemptDetail(id);

  if (!attempt || attempt.studentId !== currentStudent.student.id) {
    return NextResponse.json({ error: '未找到可提交的测试记录。' }, { status: 404, headers: noStoreHeaders });
  }

  if (attempt.status !== 'started') {
    return NextResponse.json({ redirectTo: `/result/${id}` }, { headers: noStoreHeaders });
  }

  const payloadJson = await request.json().catch(() => null);
  const parsedPayload = submitAttemptSchema.safeParse(payloadJson);

  if (!parsedPayload.success) {
    return NextResponse.json({ error: '提交内容无效。' }, { status: 400, headers: noStoreHeaders });
  }

  const maxTypedTextLength = Math.min(
    50_000,
    Math.max((attempt.articleContent?.length ?? 0) * 4, 4_000),
  );
  if (parsedPayload.data.typedTextRaw.length > maxTypedTextLength) {
    return NextResponse.json({ error: '提交内容过长。' }, { status: 400, headers: noStoreHeaders });
  }

  const submittedAt = new Date();
  const serverElapsedSeconds = Math.max(1, Math.floor((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000));
  const durationSecondsUsed = Math.min(attempt.durationSecondsAllocated, serverElapsedSeconds);
  const typedTextRaw = parsedPayload.data.typedTextRaw;
  const typedTextNormalized = normalizeTypingText(typedTextRaw);
  const metrics = calculateTypingMetrics({
    referenceText: attempt.articleContent ?? '',
    typedText: typedTextRaw,
    durationSeconds: durationSecondsUsed,
  });

  const suspicionFlags: string[] = [];
  if (metrics.scoreKpm > 900) suspicionFlags.push('score_unusually_high');
  if (durationSecondsUsed < 10 && metrics.charCountTyped > 20) suspicionFlags.push('submitted_too_fast');
  if (typedTextRaw.length > (attempt.articleContent?.length ?? 0) * 2 && typedTextRaw.length > 4_000) {
    suspicionFlags.push('typed_text_unusually_long');
  }

  const requestUserAgent = request.headers.get('user-agent');
  const requestIp = getTrustedRequestIp(request.headers);
  const updateResult = await withDatabaseRetry('submitAttempt.updateAttempt', async () => (
    db.update(attempts).set({
      status: 'submitted',
      submittedAt,
      durationSecondsUsed,
      typedTextRaw,
      typedTextNormalized,
      charCountTyped: metrics.charCountTyped,
      charCountCorrect: metrics.charCountCorrect,
      charCountError: metrics.charCountError,
      backspaceCount: parsedPayload.data.backspaceCount,
      clientMeta: parsedPayload.data.clientMeta,
      suspicionFlags,
      scoreKpm: metrics.scoreKpm,
      accuracy: metrics.accuracy,
      scoreVersion: 'v2',
      ipAddress: requestIp,
      userAgent: requestUserAgent,
      updatedAt: new Date(),
    }).where(and(
      eq(attempts.id, id),
      eq(attempts.studentId, currentStudent.student.id),
      eq(attempts.status, 'started'),
    ))
  ));

  if (updateResult.rowsAffected === 0) {
    return NextResponse.json({ redirectTo: `/result/${id}` }, { headers: noStoreHeaders });
  }

  return NextResponse.json({ redirectTo: `/result/${id}` }, { headers: noStoreHeaders });
}
