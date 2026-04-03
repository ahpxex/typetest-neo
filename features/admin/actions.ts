'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db, withDatabaseRetry } from '@/db/client';
import { studentEmailVerificationTokens, students } from '@/db/schema';
import { canManageStudents } from '@/lib/auth/admin-authorization';
import { getCurrentAdmin, revokeSessionsForUser } from '@/lib/auth/session';
import { isCampusEmailMatch, parseStudentIdentity } from '@/lib/student-identity';

function getRedirectTarget(formData: FormData, fallback: string) {
  const redirectTo = formData.get('redirectTo');
  return typeof redirectTo === 'string' && redirectTo.startsWith('/') ? redirectTo : fallback;
}

function redirectWithNotice(path: string, key: 'success' | 'error', message: string): never {
  const target = new URL(path, 'http://localhost');
  target.searchParams.set(key, message);
  redirect(`${target.pathname}${target.search}`);
}

async function requireStudentManagementAdmin(redirectTo: string) {
  const currentAdmin = await getCurrentAdmin();

  if (!currentAdmin) {
    redirect('/admin/login');
  }

  if (!canManageStudents(currentAdmin.admin.role)) {
    redirectWithNotice(redirectTo, 'error', '当前账号没有执行该管理操作的权限。');
  }

  return currentAdmin;
}

function buildStudentInsertPayload(data: z.infer<typeof studentSchema>) {
  const parsedIdentity = parseStudentIdentity(data.studentNo);

  if (!parsedIdentity) {
    return null;
  }

  if (!isCampusEmailMatch(parsedIdentity.studentNo, data.campusEmail)) {
    return null;
  }

  return {
    studentNo: parsedIdentity.studentNo,
    name: data.name.trim(),
    campusEmail: parsedIdentity.campusEmail,
    enrollmentYear: parsedIdentity.enrollmentYear,
    schoolCode: parsedIdentity.schoolCode,
    majorCode: parsedIdentity.majorCode,
    classSerial: parsedIdentity.classSerial,
    notes: data.notes ?? null,
    status: 'active' as const,
  };
}

const studentSchema = z.object({
  studentNo: z.string().trim().min(1),
  name: z.string().trim().min(1),
  campusEmail: z
    .string()
    .trim()
    .email()
    .refine((value) => value.toLowerCase().endsWith('@ucass.edu.cn'), '校园邮箱必须以 @ucass.edu.cn 结尾'),
  notes: z.string().trim().optional(),
});

export async function createStudentAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin');
  await requireStudentManagementAdmin(redirectTo);
  const parsed = studentSchema.safeParse({
    studentNo: formData.get('studentNo'),
    name: formData.get('name'),
    campusEmail: formData.get('campusEmail'),
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    redirectWithNotice(redirectTo, 'error', parsed.error.issues[0]?.message ?? '学生信息不完整');
  }

  const data = parsed.data;
  const payload = buildStudentInsertPayload(data);

  if (!payload) {
    redirectWithNotice(redirectTo, 'error', '学号或校园邮箱不合法');
  }

  await withDatabaseRetry('createStudentAction.upsertStudent', async () => {
    await db
      .insert(students)
      .values(payload)
      .onConflictDoUpdate({
        target: students.studentNo,
        set: {
          name: payload.name,
          campusEmail: payload.campusEmail,
          enrollmentYear: payload.enrollmentYear,
          schoolCode: payload.schoolCode,
          majorCode: payload.majorCode,
          classSerial: payload.classSerial,
          notes: payload.notes,
          updatedAt: new Date(),
        },
      });
  });

  revalidatePath('/admin');
  redirectWithNotice(redirectTo, 'success', '学生已保存');
}

export async function importStudentsCsvAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin');
  await requireStudentManagementAdmin(redirectTo);
  const csvText = String(formData.get('csvText') ?? '').trim();

  if (!csvText) {
    redirectWithNotice(redirectTo, 'error', '请先粘贴 CSV 内容');
  }

  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = lines[0]?.toLowerCase();
  const hasHeader = header === 'student_no,name,campus_email' || header === 'student_no,name,class_code,campus_email';
  const dataLines = hasHeader ? lines.slice(1) : lines;

  if (dataLines.length === 0) {
    redirectWithNotice(redirectTo, 'error', 'CSV 内容为空');
  }

  for (const line of dataLines) {
    const parts = line.split(',').map((part) => part.trim());
    const [studentNo = '', name = '', third = '', fourth = ''] = parts;
    const campusEmail = parts.length >= 4 ? fourth : third;

    const parsed = studentSchema.safeParse({
      studentNo,
      name,
      campusEmail,
      notes: undefined,
    });

    if (!parsed.success) {
      redirectWithNotice(redirectTo, 'error', `导入失败：${line}`);
    }

    const data = parsed.data;
    const payload = buildStudentInsertPayload(data);

    if (!payload) {
      redirectWithNotice(redirectTo, 'error', `导入失败：${line}`);
    }

    await withDatabaseRetry('importStudentsCsvAction.upsertStudent', async () => {
      await db
        .insert(students)
        .values(payload)
        .onConflictDoUpdate({
          target: students.studentNo,
          set: {
            name: payload.name,
            campusEmail: payload.campusEmail,
            enrollmentYear: payload.enrollmentYear,
            schoolCode: payload.schoolCode,
            majorCode: payload.majorCode,
            classSerial: payload.classSerial,
            notes: payload.notes,
            updatedAt: new Date(),
          },
        });
    });
  }

  revalidatePath('/admin');
  redirectWithNotice(redirectTo, 'success', `已导入 ${dataLines.length} 条学生记录`);
}

export async function updateStudentStatusAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin');
  await requireStudentManagementAdmin(redirectTo);
  const studentId = z.coerce.number().int().positive().parse(formData.get('studentId'));
  const status = z.enum(['active', 'inactive']).parse(formData.get('status'));
  const now = new Date();

  await withDatabaseRetry('updateStudentStatusAction.updateStudent', async () => {
    await db
      .update(students)
      .set({
        status,
        updatedAt: now,
      })
      .where(eq(students.id, studentId));
  });

  if (status === 'inactive') {
    await revokeSessionsForUser('student', studentId);

    await withDatabaseRetry('updateStudentStatusAction.consumeVerificationTokens', async () => {
      await db
        .update(studentEmailVerificationTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(studentEmailVerificationTokens.studentId, studentId),
            isNull(studentEmailVerificationTokens.consumedAt),
          ),
        );
    });
  }

  revalidatePath('/admin');
  redirectWithNotice(redirectTo, 'success', '学生状态已更新');
}
