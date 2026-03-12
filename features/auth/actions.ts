'use server';

import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';

import { db } from '@/db/client';
import { studentEmailVerificationTokens, students } from '@/db/schema';
import { clearSession, createSession } from '@/lib/auth/session';
import { createEmailVerificationToken, hashEmailVerificationToken } from '@/lib/auth/email-verification';
import { checkLoginRateLimit, recordLoginAttempt } from '@/lib/auth/login-rate-limit';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { getAdminByUsername } from '@/lib/data/queries';
import {
  DEV_ADMIN_USERNAME,
  DEV_STUDENT_NO,
  EMAIL_VERIFICATION_COOLDOWN_SECONDS,
  EMAIL_VERIFICATION_TTL_HOURS,
  PASSWORD_MIN_LENGTH,
  isDevelopment,
} from '@/lib/env';
import { getAppBaseUrl } from '@/lib/app-url';
import { sendStudentVerificationEmail } from '@/lib/mail/provider';
import { isCampusEmailMatch, parseStudentIdentity } from '@/lib/student-identity';

export type AuthFormState = {
  error?: string;
  success?: string;
};

const EMAIL_VERIFICATION_IP_WINDOW_MINUTES = 15;
const EMAIL_VERIFICATION_IP_WINDOW_MAX_REQUESTS = 8;

const studentLoginSchema = z.object({
  campusEmail: z
    .string()
    .trim()
    .email('请输入合法邮箱')
    .refine((value) => value.toLowerCase().endsWith('@ucass.edu.cn'), '校园邮箱必须以 @ucass.edu.cn 结尾'),
  password: z.string().min(1, '请输入密码'),
});

const studentRegisterSchema = z
  .object({
    studentNo: z.string().trim().min(1, '请输入学号'),
    name: z.string().trim().min(1, '请输入姓名'),
    campusEmail: z
      .string()
      .trim()
      .email('请输入合法邮箱')
      .refine((value) => value.toLowerCase().endsWith('@ucass.edu.cn'), '校园邮箱必须以 @ucass.edu.cn 结尾'),
    password: z.string().min(PASSWORD_MIN_LENGTH, `密码至少需要 ${PASSWORD_MIN_LENGTH} 位`),
    passwordConfirm: z.string().min(1, '请再次输入密码'),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '两次输入的密码不一致。',
  });

const verifyEmailSchema = z.object({
  token: z.string().trim().min(1, '确认链接无效。'),
});

const adminLoginSchema = z.object({
  username: z.string().trim().min(1, '请输入管理员账号'),
  password: z.string().min(1, '请输入管理员密码'),
});

function normalizeCampusEmail(campusEmail: string) {
  return campusEmail.trim().toLowerCase();
}

async function getRequestClientInfo() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get('x-forwarded-for');

  return {
    requestIp: forwardedFor?.split(',')[0]?.trim() ?? requestHeaders.get('x-real-ip'),
    requestUserAgent: requestHeaders.get('user-agent'),
  };
}

function redirectWithNotice(path: string, key: 'success' | 'error', message: string): never {
  const target = new URL(path, 'http://localhost');
  target.searchParams.set(key, message);
  redirect(`${target.pathname}${target.search}`);
}

async function getStudentByCampusEmail(campusEmail: string) {
  const normalizedCampusEmail = normalizeCampusEmail(campusEmail);
  const [student] = await db
    .select()
    .from(students)
    .where(sql<boolean>`lower(${students.campusEmail}) = ${normalizedCampusEmail}`)
    .limit(1);

  return student ?? null;
}

async function getStudentForRegistration(studentNo: string, campusEmail: string) {
  const normalizedCampusEmail = normalizeCampusEmail(campusEmail);
  const [student] = await db
    .select()
    .from(students)
    .where(
      or(
        eq(students.studentNo, studentNo),
        sql<boolean>`lower(${students.campusEmail}) = ${normalizedCampusEmail}`,
      ),
    )
    .limit(1);

  return student ?? null;
}

export async function studentLoginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = studentLoginSchema.safeParse({
    campusEmail: formData.get('campusEmail'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '登录信息不完整。' };
  }

  const campusEmail = normalizeCampusEmail(parsed.data.campusEmail);
  const clientInfo = await getRequestClientInfo();
  const rateLimit = await checkLoginRateLimit('student_login', {
    identifier: campusEmail,
    ipAddress: clientInfo.requestIp,
  });

  if (rateLimit.blocked) {
    return { error: rateLimit.message ?? '登录尝试过于频繁，请稍后再试。' };
  }

  const student = await getStudentByCampusEmail(campusEmail);

  if (!student || !student.passwordHash || !verifyPassword(parsed.data.password, student.passwordHash)) {
    await recordLoginAttempt('student_login', {
      identifier: campusEmail,
      ipAddress: clientInfo.requestIp,
      wasSuccessful: false,
    });
    return { error: '邮箱或密码错误。' };
  }

  if (student.status === 'inactive') {
    await recordLoginAttempt('student_login', {
      identifier: campusEmail,
      ipAddress: clientInfo.requestIp,
      wasSuccessful: false,
    });
    return { error: '该学生账号已被停用，请联系管理员。' };
  }

  if (!student.emailVerifiedAt) {
    await recordLoginAttempt('student_login', {
      identifier: campusEmail,
      ipAddress: clientInfo.requestIp,
      wasSuccessful: false,
    });
    return { error: '请先查收确认邮件并完成邮箱验证。' };
  }

  await db
    .update(students)
    .set({
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(students.id, student.id));

  await clearSession('student');
  await createSession('student', student.id);
  await recordLoginAttempt('student_login', {
    identifier: campusEmail,
    ipAddress: clientInfo.requestIp,
    wasSuccessful: true,
  });

  redirect('/typing');
}

export async function studentRegisterAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = studentRegisterSchema.safeParse({
    studentNo: formData.get('studentNo'),
    name: formData.get('name'),
    campusEmail: formData.get('campusEmail'),
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '注册信息不完整。' };
  }

  const parsedIdentity = parseStudentIdentity(parsed.data.studentNo);

  if (!parsedIdentity) {
    return { error: '请输入 11 位数字学号。' };
  }

  if (!isCampusEmailMatch(parsedIdentity.studentNo, parsed.data.campusEmail)) {
    return { error: '校园邮箱必须与学号对应。' };
  }

  const campusEmail = parsedIdentity.campusEmail;
  const existingStudent = await getStudentForRegistration(parsedIdentity.studentNo, campusEmail);

  if (existingStudent && existingStudent.studentNo !== parsedIdentity.studentNo) {
    return { error: '该校园邮箱已被其他账号占用。' };
  }

  if (existingStudent?.status === 'inactive') {
    return { error: '该学生账号已被停用，请联系管理员。' };
  }

  if (existingStudent?.passwordHash && existingStudent.emailVerifiedAt) {
    return { error: '该邮箱已经完成注册，请直接返回登录。' };
  }

  const now = new Date();
  const nextPasswordHash = hashPassword(parsed.data.password);

  if (existingStudent) {
    await db
      .update(students)
      .set({
        name: parsed.data.name.trim(),
        campusEmail,
        enrollmentYear: parsedIdentity.enrollmentYear,
        schoolCode: parsedIdentity.schoolCode,
        majorCode: parsedIdentity.majorCode,
        classSerial: parsedIdentity.classSerial,
        passwordHash: nextPasswordHash,
        emailVerifiedAt: null,
        updatedAt: now,
      })
      .where(eq(students.id, existingStudent.id));
  } else {
    await db.insert(students).values({
      studentNo: parsedIdentity.studentNo,
      name: parsed.data.name.trim(),
      campusEmail,
      enrollmentYear: parsedIdentity.enrollmentYear,
      schoolCode: parsedIdentity.schoolCode,
      majorCode: parsedIdentity.majorCode,
      classSerial: parsedIdentity.classSerial,
      passwordHash: nextPasswordHash,
      status: 'active',
      emailVerifiedAt: null,
      lastLoginAt: null,
    });
  }

  const [currentStudent] = await db
    .select()
    .from(students)
    .where(eq(students.studentNo, parsedIdentity.studentNo))
    .limit(1);

  if (!currentStudent) {
    return { error: '注册失败，请稍后重试。' };
  }

  const [latestToken] = await db
    .select()
    .from(studentEmailVerificationTokens)
    .where(
      and(
        eq(studentEmailVerificationTokens.studentId, currentStudent.id),
        isNull(studentEmailVerificationTokens.consumedAt),
      ),
    )
    .orderBy(desc(studentEmailVerificationTokens.createdAt))
    .limit(1);

  if (latestToken) {
    const elapsedSeconds = Math.floor((Date.now() - latestToken.createdAt.getTime()) / 1000);

    if (elapsedSeconds < EMAIL_VERIFICATION_COOLDOWN_SECONDS) {
      return {
        error: `确认邮件发送过于频繁，请在 ${EMAIL_VERIFICATION_COOLDOWN_SECONDS - elapsedSeconds} 秒后重试。`,
      };
    }
  }

  const { token, tokenHash } = createEmailVerificationToken();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);
  const { requestIp, requestUserAgent } = await getRequestClientInfo();

  if (requestIp) {
    const ipWindowStart = new Date(Date.now() - EMAIL_VERIFICATION_IP_WINDOW_MINUTES * 60 * 1000);
    const [ipRecentRequestCount] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(studentEmailVerificationTokens)
      .where(
        and(
          eq(studentEmailVerificationTokens.requestIp, requestIp),
          sql<boolean>`${studentEmailVerificationTokens.createdAt} >= ${ipWindowStart}`,
        ),
      );

    if ((ipRecentRequestCount?.count ?? 0) >= EMAIL_VERIFICATION_IP_WINDOW_MAX_REQUESTS) {
      return {
        error: `当前网络环境请求过于频繁，请在 ${EMAIL_VERIFICATION_IP_WINDOW_MINUTES} 分钟后再试。`,
      };
    }
  }

  await db
    .update(studentEmailVerificationTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(studentEmailVerificationTokens.studentId, currentStudent.id),
        isNull(studentEmailVerificationTokens.consumedAt),
      ),
    );

  await db.insert(studentEmailVerificationTokens).values({
    studentId: currentStudent.id,
    tokenHash,
    expiresAt,
    requestIp,
    requestUserAgent,
  });

  const appBaseUrl = await getAppBaseUrl();
  const verificationUrl = new URL('/verify-email', appBaseUrl);
  verificationUrl.searchParams.set('token', token);

  try {
    await sendStudentVerificationEmail({
      to: campusEmail,
      name: currentStudent.name,
      studentNo: currentStudent.studentNo,
      verificationUrl: verificationUrl.toString(),
    });
  } catch (error) {
    console.error('[auth] Failed to send student verification email', error);

    await db
      .delete(studentEmailVerificationTokens)
      .where(eq(studentEmailVerificationTokens.tokenHash, tokenHash));

    return { error: '确认邮件发送失败，请稍后重试。' };
  }

  return {
    success: `确认邮件已发送至 ${campusEmail}，请查收邮件并完成验证。`,
  };
}

export async function verifyStudentEmailAction(formData: FormData) {
  const parsed = verifyEmailSchema.safeParse({
    token: formData.get('token'),
  });

  if (!parsed.success) {
    redirectWithNotice('/verify-email', 'error', parsed.error.issues[0]?.message ?? '确认链接无效。');
  }

  const tokenHash = hashEmailVerificationToken(parsed.data.token);
  const [tokenRecord] = await db
    .select()
    .from(studentEmailVerificationTokens)
    .where(eq(studentEmailVerificationTokens.tokenHash, tokenHash))
    .limit(1);

  if (!tokenRecord) {
    redirectWithNotice('/verify-email', 'error', '确认链接无效或已失效。');
  }

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, tokenRecord.studentId))
    .limit(1);

  if (!student) {
    redirectWithNotice('/verify-email', 'error', '对应学生账号不存在。');
  }

  if (student.status === 'inactive') {
    redirectWithNotice('/', 'error', '该学生账号已被停用，请联系管理员。');
  }

  if (student.emailVerifiedAt) {
    redirectWithNotice('/', 'success', '邮箱已经确认，可以直接登录。');
  }

  if (tokenRecord.consumedAt) {
    redirectWithNotice('/verify-email', 'error', '这封确认邮件已经被使用过了。');
  }

  if (tokenRecord.expiresAt.getTime() <= Date.now()) {
    redirectWithNotice('/verify-email', 'error', '确认链接已过期，请重新注册。');
  }

  const verifiedAt = new Date();

  await db
    .update(students)
    .set({
      emailVerifiedAt: verifiedAt,
      updatedAt: verifiedAt,
    })
    .where(eq(students.id, student.id));

  await db
    .update(studentEmailVerificationTokens)
    .set({ consumedAt: verifiedAt })
    .where(
      and(
        eq(studentEmailVerificationTokens.studentId, student.id),
        isNull(studentEmailVerificationTokens.consumedAt),
      ),
    );

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

  const username = parsed.data.username.trim().toLowerCase();
  const clientInfo = await getRequestClientInfo();
  const rateLimit = await checkLoginRateLimit('admin_login', {
    identifier: username,
    ipAddress: clientInfo.requestIp,
  });

  if (rateLimit.blocked) {
    return { error: rateLimit.message ?? '登录尝试过于频繁，请稍后再试。' };
  }

  const admin = await getAdminByUsername(parsed.data.username);

  if (!admin || !verifyPassword(parsed.data.password, admin.passwordHash)) {
    await recordLoginAttempt('admin_login', {
      identifier: username,
      ipAddress: clientInfo.requestIp,
      wasSuccessful: false,
    });
    return { error: '管理员账号或密码错误。' };
  }

  await clearSession('admin');
  await createSession('admin', admin.id);
  await recordLoginAttempt('admin_login', {
    identifier: username,
    ipAddress: clientInfo.requestIp,
    wasSuccessful: true,
  });

  redirect('/admin');
}

export async function devLoginStudentAction() {
  if (!isDevelopment) {
    redirect('/');
  }

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.studentNo, DEV_STUDENT_NO))
    .limit(1);

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
