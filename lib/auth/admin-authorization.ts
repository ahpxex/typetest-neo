import type { AdminUser } from '@/db/schema';

export function canManageStudents(role: AdminUser['role']) {
  return role === 'admin';
}

export function canExportAttempts(role: AdminUser['role']) {
  return role === 'admin';
}

export function canViewStudentAttempts(role: AdminUser['role']) {
  return role === 'admin' || role === 'teacher';
}

export function canManageCompetitions(role: AdminUser['role']) {
  return role === 'admin';
}

export function canViewCompetitions(role: AdminUser['role']) {
  return role === 'admin' || role === 'teacher';
}

export function canManageArticles(role: AdminUser['role']) {
  return role === 'admin';
}

export function canViewArticles(role: AdminUser['role']) {
  return role === 'admin' || role === 'teacher';
}
