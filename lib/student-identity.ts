import { CAMPUS_EMAIL_DOMAIN } from '@/lib/env';

export const STUDENT_NO_LENGTH = 11;

export type ParsedStudentIdentity = {
  studentNo: string;
  enrollmentYear: string;
  schoolCode: string;
  majorCode: string;
  classSerial: string;
  campusEmail: string;
};

export function normalizeStudentNo(studentNo: string) {
  return studentNo.trim();
}

export function isStudentNoFormatValid(studentNo: string) {
  return /^\d{11}$/.test(normalizeStudentNo(studentNo));
}

export function buildCampusEmail(studentNo: string) {
  const normalizedStudentNo = normalizeStudentNo(studentNo);

  if (!isStudentNoFormatValid(normalizedStudentNo)) {
    return '';
  }

  return `${normalizedStudentNo}@${CAMPUS_EMAIL_DOMAIN}`;
}

export function parseStudentIdentity(studentNo: string): ParsedStudentIdentity | null {
  const normalizedStudentNo = normalizeStudentNo(studentNo);

  if (!isStudentNoFormatValid(normalizedStudentNo)) {
    return null;
  }

  return {
    studentNo: normalizedStudentNo,
    enrollmentYear: normalizedStudentNo.slice(0, 4),
    schoolCode: normalizedStudentNo.slice(4, 7),
    majorCode: normalizedStudentNo.slice(4, 9),
    classSerial: normalizedStudentNo.slice(9, 11),
    campusEmail: buildCampusEmail(normalizedStudentNo),
  };
}

export function isCampusEmailMatch(studentNo: string, campusEmail: string) {
  const expectedCampusEmail = buildCampusEmail(studentNo);

  if (!expectedCampusEmail) {
    return false;
  }

  return campusEmail.trim().toLowerCase() === expectedCampusEmail.toLowerCase();
}
