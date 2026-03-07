'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/db/client';
import { attempts, students } from '@/db/schema';

function getRedirectTarget(formData: FormData, fallback: string) {
  const redirectTo = formData.get('redirectTo');
  return typeof redirectTo === 'string' && redirectTo.startsWith('/') ? redirectTo : fallback;
}

function redirectWithNotice(path: string, key: 'success' | 'error', message: string): never {
  const target = new URL(path, 'http://localhost');
  target.searchParams.set(key, message);
  redirect(`${target.pathname}${target.search}`);
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

const attemptStatusSchema = z.enum(['submitted', 'invalidated']);

export async function createStudentAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin/students');
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

  await db
    .insert(students)
    .values({
      studentNo: data.studentNo,
      name: data.name,
      campusEmail: data.campusEmail.toLowerCase(),
      notes: data.notes ?? null,
      status: 'active',
    })
    .onConflictDoUpdate({
      target: students.studentNo,
      set: {
        name: data.name,
        campusEmail: data.campusEmail.toLowerCase(),
        notes: data.notes ?? null,
        updatedAt: new Date(),
      },
    });

  revalidatePath('/admin/students');
  redirectWithNotice(redirectTo, 'success', '学生已保存');
}

export async function importStudentsCsvAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin/students');
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

    await db
      .insert(students)
      .values({
        studentNo: data.studentNo,
        name: data.name,
        campusEmail: data.campusEmail.toLowerCase(),
        notes: null,
        status: 'active',
      })
      .onConflictDoUpdate({
        target: students.studentNo,
        set: {
          name: data.name,
          campusEmail: data.campusEmail.toLowerCase(),
            notes: null,
          updatedAt: new Date(),
        },
      });
  }

  revalidatePath('/admin/students');
  redirectWithNotice(redirectTo, 'success', `已导入 ${dataLines.length} 条学生记录`);
}

export async function updateStudentStatusAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin/students');
  const studentId = z.coerce.number().int().positive().parse(formData.get('studentId'));
  const status = z.enum(['active', 'inactive']).parse(formData.get('status'));

  await db
    .update(students)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(students.id, studentId));

  revalidatePath('/admin/students');
  redirectWithNotice(redirectTo, 'success', '学生状态已更新');
}

export async function setAttemptStatusAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin/attempts');
  const attemptId = z.coerce.number().int().positive().parse(formData.get('attemptId'));
  const status = attemptStatusSchema.parse(formData.get('status'));

  await db
    .update(attempts)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(attempts.id, attemptId));

  revalidatePath('/admin/attempts');
  redirectWithNotice(redirectTo, 'success', '成绩状态已更新');
}
