import { NextResponse } from 'next/server';

import { getCurrentAdmin } from '@/lib/auth/session';
import { getExportRows } from '@/lib/data/queries';
import { formatDateTime } from '@/lib/format';

function escapeCsv(value: unknown) {
  const stringValue = String(value ?? '');
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

export async function GET() {
  const currentAdmin = await getCurrentAdmin();

  if (!currentAdmin) {
    return NextResponse.json({ error: '管理员未登录。' }, { status: 401 });
  }

  const rows = await getExportRows();

  const headers = [
    'student_no',
    'student_name',
    'campus_email',
    'enrollment_year',
    'school_code',
    'major_code',
    'mode',
    'article_title',
    'score_kpm',
    'accuracy',
    'status',
    'started_at',
    'submitted_at',
    'duration_seconds_used',
    'backspace_count',
    'paste_count',
    'suspicion_flags',
    'ip_address',
  ];

  const body = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.studentNo,
        row.studentName,
        row.campusEmail,
        row.enrollmentYear ?? '',
        row.schoolCode ?? '',
        row.majorCode ?? '',
        row.mode,
        row.articleTitle,
        row.scoreKpm,
        row.accuracy,
        row.status,
        formatDateTime(row.startedAt),
        formatDateTime(row.submittedAt),
        row.durationSecondsUsed ?? '',
        row.backspaceCount,
        row.pasteCount,
        row.suspicionFlags.join('|'),
        row.ipAddress ?? '',
      ]
        .map(escapeCsv)
        .join(','),
    ),
  ].join('\n');

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="attempts-all.csv"',
    },
  });
}
