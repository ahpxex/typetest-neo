import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db/client';
import { attempts } from '@/db/schema';
import { getCurrentStudent } from '@/lib/auth/session';
import { getAttemptDetail } from '@/lib/data/queries';
import { calculateStrictAccuracy, calculateTypingMetrics, normalizeTypingText } from '@/modules/typing-engine';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const currentStudent = await getCurrentStudent();

  if (!currentStudent) {
    return NextResponse.json({ error: '未登录或登录已失效。' }, { status: 401 });
  }

  const { attemptId } = await params;
  const id = Number(attemptId);
  const attempt = await getAttemptDetail(id);

  if (!attempt || attempt.studentId !== currentStudent.student.id) {
    return NextResponse.json({ error: '未找到可提交的测试记录。' }, { status: 404 });
  }

  if (attempt.status !== 'started') {
    return NextResponse.json({ redirectTo: `/result/${id}` });
  }

  const payload = (await request.json()) as {
    typedTextRaw?: string;
    durationSecondsUsed?: number;
    backspaceCount?: number;
    pasteCount?: number;
    inputCharCount?: number;
    mistypedCharCount?: number;
    clientMeta?: Record<string, unknown>;
  };

  const submittedAt = new Date();
  const serverElapsedSeconds = Math.max(1, Math.floor((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000));
  const durationSecondsUsed = Math.min(attempt.durationSecondsAllocated, serverElapsedSeconds);
  const typedTextRaw = payload.typedTextRaw ?? '';
  const typedTextNormalized = normalizeTypingText(typedTextRaw);
  const metrics = calculateTypingMetrics({
    referenceText: attempt.articleContent ?? '',
    typedText: typedTextRaw,
    durationSeconds: durationSecondsUsed,
  });

  const inputCharCount = Number.isFinite(payload.inputCharCount)
    ? Math.max(0, Math.floor(payload.inputCharCount ?? 0))
    : metrics.charCountTyped;
  const mistypedCharCount = Number.isFinite(payload.mistypedCharCount)
    ? Math.max(0, Math.floor(payload.mistypedCharCount ?? 0))
    : metrics.charCountError;
  const strictAccuracy = calculateStrictAccuracy({
    inputCharCount,
    mistypedCharCount,
  });

  const suspicionFlags: string[] = [];
  if ((payload.pasteCount ?? 0) > 0) suspicionFlags.push('paste_detected');
  if (metrics.scoreKpm > 900) suspicionFlags.push('score_unusually_high');
  if (durationSecondsUsed < 10 && metrics.charCountTyped > 20) suspicionFlags.push('submitted_too_fast');

  await db.update(attempts).set({
    status: 'submitted',
    submittedAt,
    durationSecondsUsed,
    typedTextRaw,
    typedTextNormalized,
    charCountTyped: metrics.charCountTyped,
    charCountCorrect: metrics.charCountCorrect,
    charCountError: metrics.charCountError,
    backspaceCount: payload.backspaceCount ?? 0,
    pasteCount: payload.pasteCount ?? 0,
    clientMeta: payload.clientMeta ?? {},
    suspicionFlags,
    scoreKpm: metrics.scoreKpm,
    accuracy: strictAccuracy,
    scoreVersion: 'v2',
    updatedAt: new Date(),
  }).where(and(eq(attempts.id, id), eq(attempts.studentId, currentStudent.student.id)));

  return NextResponse.json({ redirectTo: `/result/${id}` });
}
