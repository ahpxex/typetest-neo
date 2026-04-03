import type { AdminUser } from '@/db/schema';

export function canManageStudents(role: AdminUser['role']) {
  return role === 'admin';
}

export function canExportAttempts(role: AdminUser['role']) {
  return role === 'admin';
}
