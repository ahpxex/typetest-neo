import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { adminUsers, articles, students } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { buildCampusEmail, parseStudentIdentity } from '@/lib/student-identity';

const DEV_ADMIN = {
  username: 'admin',
  password: 'admin123456',
  displayName: '开发环境管理员',
} as const;

const DEV_STUDENT = {
  studentNo: '20261141128',
  name: '测试学生',
  campusEmail: buildCampusEmail('20261141128'),
  password: 'student123456',
} as const;

const DEV_ARTICLE = {
  slug: 'dev-typing-article',
  title: 'Development Typing Article',
  language: 'en' as const,
  contentRaw:
    'Typing in development should be easy, predictable, and good enough for rapid iteration.',
};

function normalizeText(input: string) {
  return input.replace(/\r\n/g, '\n').trim();
}

function wordCount(input: string) {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

async function seedStudent() {
  const parsedIdentity = parseStudentIdentity(DEV_STUDENT.studentNo);

  if (!parsedIdentity) {
    throw new Error('Invalid dev student number.');
  }

  await db.insert(students)
    .values({
      ...DEV_STUDENT,
      enrollmentYear: parsedIdentity.enrollmentYear,
      schoolCode: parsedIdentity.schoolCode,
      majorCode: parsedIdentity.majorCode,
      classSerial: parsedIdentity.classSerial,
      passwordHash: hashPassword(DEV_STUDENT.password),
      emailVerifiedAt: new Date(),
      lastLoginAt: null,
    })
    .onConflictDoUpdate({
      target: students.studentNo,
      set: {
        name: DEV_STUDENT.name,
        campusEmail: DEV_STUDENT.campusEmail,
        enrollmentYear: parsedIdentity.enrollmentYear,
        schoolCode: parsedIdentity.schoolCode,
        majorCode: parsedIdentity.majorCode,
        classSerial: parsedIdentity.classSerial,
        passwordHash: hashPassword(DEV_STUDENT.password),
        emailVerifiedAt: new Date(),
        status: 'active',
        updatedAt: new Date(),
      },
    });

  return db.select().from(students).where(eq(students.studentNo, DEV_STUDENT.studentNo)).get();
}

async function seedAdmin() {
  await db.insert(adminUsers)
    .values({
      username: DEV_ADMIN.username,
      passwordHash: hashPassword(DEV_ADMIN.password),
      displayName: DEV_ADMIN.displayName,
      role: 'admin',
      status: 'active',
    })
    .onConflictDoUpdate({
      target: adminUsers.username,
      set: {
        displayName: DEV_ADMIN.displayName,
        role: 'admin',
        status: 'active',
        updatedAt: new Date(),
      },
    });

  return db.select().from(adminUsers).where(eq(adminUsers.username, DEV_ADMIN.username)).get();
}

async function seedArticle() {
  const contentNormalized = normalizeText(DEV_ARTICLE.contentRaw);

  await db.insert(articles)
    .values({
      ...DEV_ARTICLE,
      contentNormalized,
      charCount: contentNormalized.length,
      wordCount: wordCount(contentNormalized),
      difficultyLevel: 1,
      status: 'published',
      source: 'seed:dev',
    })
    .onConflictDoUpdate({
      target: articles.slug,
      set: {
        title: DEV_ARTICLE.title,
        language: DEV_ARTICLE.language,
        contentRaw: DEV_ARTICLE.contentRaw,
        contentNormalized,
        charCount: contentNormalized.length,
        wordCount: wordCount(contentNormalized),
        difficultyLevel: 1,
        status: 'published',
        source: 'seed:dev',
        updatedAt: new Date(),
      },
    });

  return db.select().from(articles).where(eq(articles.slug, DEV_ARTICLE.slug)).get();
}

async function main() {
  const admin = await seedAdmin();
  const student = await seedStudent();
  const article = await seedArticle();

  if (!admin || !student || !article) {
    throw new Error('Failed to seed development identities.');
  }

  console.log('Development seed complete.');
  console.log('');
  console.log('Admin login');
  console.log(`- username: ${DEV_ADMIN.username}`);
  console.log(`- password: ${DEV_ADMIN.password}`);
  console.log('');
  console.log('Student login');
  console.log(`- studentNo: ${student.studentNo}`);
  console.log(`- name: ${student.name}`);
  console.log(`- campusEmail: ${student.campusEmail}`);
  console.log(`- password: ${DEV_STUDENT.password}`);
  console.log('');
  console.log('Default article');
  console.log(`- article: ${article.title}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
