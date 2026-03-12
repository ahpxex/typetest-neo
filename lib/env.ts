export const isDevelopment = process.env.NODE_ENV !== 'production';

export const APP_NAME = '社科大打字测试系统';
export const APP_DESCRIPTION = '面向 UCASS 的打字测试、管理与成绩平台';
export const APP_BASE_URL = process.env.APP_BASE_URL?.trim() || 'http://localhost:3000';
export const CAMPUS_EMAIL_DOMAIN = 'ucass.edu.cn';
export const STUDENT_SESSION_COOKIE = 'typetest_student_session';
export const ADMIN_SESSION_COOKIE = 'typetest_admin_session';
export const SESSION_DURATION_DAYS = 7;
export const PASSWORD_MIN_LENGTH = 8;
export const EMAIL_VERIFICATION_TTL_HOURS = Number(process.env.EMAIL_VERIFICATION_TTL_HOURS ?? '24');
export const EMAIL_VERIFICATION_COOLDOWN_SECONDS = Number(process.env.EMAIL_VERIFICATION_COOLDOWN_SECONDS ?? '60');

export const DEV_ADMIN_USERNAME = 'admin';
export const DEV_STUDENT_NO = '20261141128';

export const TEST_DURATION_SECONDS = 180;
export const MAX_ATTEMPTS_PER_STUDENT = 999;
