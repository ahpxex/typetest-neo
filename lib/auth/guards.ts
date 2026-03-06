import { redirect } from 'next/navigation';

import { getCurrentAdmin, getCurrentStudent } from '@/lib/auth/session';

export async function requireStudent() {
  const current = await getCurrentStudent();

  if (!current) {
    redirect('/');
  }

  return current;
}

export async function requireAdmin() {
  const current = await getCurrentAdmin();

  if (!current) {
    redirect('/admin/login');
  }

  return current;
}

export async function getAnySignedInUser() {
  const admin = await getCurrentAdmin();

  if (admin) {
    return { type: 'admin' as const, ...admin };
  }

  const student = await getCurrentStudent();

  if (student) {
    return { type: 'student' as const, ...student };
  }

  return null;
}
