'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { clearSession, createSession } from '@/lib/auth/session';
import {
  getAdminByUsername,
} from '@/lib/data/queries';
import { verifyPassword } from '@/lib/auth/password';
import { DEV_ADMIN_USERNAME, DEV_STUDENT_NO, isDevelopment } from '@/lib/env';
import { db } from '@/db/client';
import { students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isCampusEmailMatch, parseStudentIdentity } from '@/lib/student-identity';

export type AuthFormState = {
  error?: string;
};

const studentLoginSchema = z.object({
  studentNo: z.string().trim().min(1, '请输入学号'),
  name: z.string().trim().min(1, '请输入姓名'),
  campusEmail: z
    .string()
    .trim()
    .email('请输入合法邮箱')
    .refine((value) => value.toLowerCase().endsWith('@ucass.edu.cn'), '校园邮箱必须以 @ucass.edu.cn 结尾'),
});

const adminLoginSchema = z.object({
  username: z.string().trim().min(1, '请输入管理员账号'),
  password: z.string().min(1, '请输入管理员密码'),
});

export async function studentLoginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = studentLoginSchema.safeParse({
    studentNo: formData.get('studentNo'),
    name: formData.get('name'),
    campusEmail: formData.get('campusEmail'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '学生登录信息不完整' };
  }

  const parsedIdentity = parseStudentIdentity(parsed.data.studentNo);

  if (!parsedIdentity) {
    return { error: '请输入 11 位数字学号。' };
  }

  if (!isCampusEmailMatch(parsedIdentity.studentNo, parsed.data.campusEmail)) {
    return { error: '校园邮箱必须与学号对应。' };
  }

  const existingStudent = await db.query.students.findFirst({
    where: eq(students.studentNo, parsedIdentity.studentNo),
  });

  if (existingStudent?.status === 'inactive') {
    return { error: '该学生账号已被停用，请联系管理员。' };
  }

  const lastLoginAt = new Date();

  await db.insert(students)
    .values({
      studentNo: parsedIdentity.studentNo,
      name: parsed.data.name.trim(),
      campusEmail: parsedIdentity.campusEmail,
      enrollmentYear: parsedIdentity.enrollmentYear,
      schoolCode: parsedIdentity.schoolCode,
      majorCode: parsedIdentity.majorCode,
      classSerial: parsedIdentity.classSerial,
      status: existingStudent?.status ?? 'active',
      emailVerifiedAt: existingStudent?.emailVerifiedAt ?? null,
      lastLoginAt,
      notes: existingStudent?.notes ?? null,
    })
    .onConflictDoUpdate({
      target: students.studentNo,
      set: {
        name: parsed.data.name.trim(),
        campusEmail: parsedIdentity.campusEmail,
        enrollmentYear: parsedIdentity.enrollmentYear,
        schoolCode: parsedIdentity.schoolCode,
        majorCode: parsedIdentity.majorCode,
        classSerial: parsedIdentity.classSerial,
        lastLoginAt,
        updatedAt: new Date(),
      },
    });

  const student = await db.query.students.findFirst({
    where: eq(students.studentNo, parsedIdentity.studentNo),
  });

  if (!student) {
    return { error: '学生登录初始化失败，请稍后重试。' };
  }

  await clearSession('student');
  await createSession('student', student.id);

  redirect('/typing');
}

export async function adminLoginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = adminLoginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '管理员登录信息不完整' };
  }

  const admin = await getAdminByUsername(parsed.data.username);

  if (!admin || !verifyPassword(parsed.data.password, admin.passwordHash)) {
    return { error: '管理员账号或密码错误。' };
  }

  await clearSession('admin');
  await createSession('admin', admin.id);

  redirect('/admin');
}

export async function devLoginStudentAction() {
  if (!isDevelopment) {
    redirect('/');
  }

  const student = await db.query.students.findFirst({
    where: eq(students.studentNo, DEV_STUDENT_NO),
  });

  if (!student) {
    redirect('/?error=dev-student-missing');
  }

  await clearSession('student');
  await createSession('student', student.id);
  redirect('/typing');
}

export async function devLoginAdminAction() {
  if (!isDevelopment) {
    redirect('/admin/login');
  }

  const admin = await getAdminByUsername(DEV_ADMIN_USERNAME);

  if (!admin) {
    redirect('/?error=dev-admin-missing');
  }

  await clearSession('admin');
  await createSession('admin', admin.id);
  redirect('/admin');
}

export async function logoutAction() {
  await clearSession('student');
  await clearSession('admin');
  redirect('/');
}
