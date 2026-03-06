'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { clearSession, createSession } from '@/lib/auth/session';
import { getAdminByUsername, getStudentByIdentity } from '@/lib/data/queries';
import { verifyPassword } from '@/lib/auth/password';

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

  const student = await getStudentByIdentity(parsed.data);

  if (!student) {
    return { error: '未找到匹配的学生信息，请检查姓名、学号和校园邮箱是否一致。' };
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

export async function logoutAction() {
  await clearSession('student');
  await clearSession('admin');
  redirect('/');
}
