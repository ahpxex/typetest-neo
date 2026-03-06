import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  adminUsers,
  articles,
  campaignArticles,
  campaignCurrentArticles,
  campaigns,
  classGroups,
  students,
} from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';

const DEV_ADMIN = {
  username: 'admin',
  password: 'admin123456',
  displayName: '开发环境管理员',
} as const;

const DEV_CLASS = {
  code: 'DEV-2026-01',
  name: '开发测试班',
  gradeYear: 2026,
  department: '开发环境',
  major: '打字测试系统',
} as const;

const DEV_STUDENT = {
  studentNo: '20260000001',
  name: '测试学生',
  campusEmail: 'student.dev@ucass.edu.cn',
} as const;

const DEV_ARTICLE = {
  slug: 'dev-typing-article',
  title: 'Development Typing Article',
  language: 'en' as const,
  contentRaw:
    'Typing in development should be easy, predictable, and good enough for rapid iteration.',
};

const DEV_CAMPAIGN = {
  name: '开发环境默认测试场次',
  academicYear: '2025-2026',
  term: 'fall',
} as const;

function normalizeText(input: string) {
  return input.replace(/\r\n/g, '\n').trim();
}

function wordCount(input: string) {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

function slugSource() {
  return 'seed:dev';
}

async function seedClassGroup() {
  await db.insert(classGroups)
    .values(DEV_CLASS)
    .onConflictDoUpdate({
      target: classGroups.code,
      set: {
        name: DEV_CLASS.name,
        gradeYear: DEV_CLASS.gradeYear,
        department: DEV_CLASS.department,
        major: DEV_CLASS.major,
        updatedAt: new Date(),
      },
    });

  return db
    .select()
    .from(classGroups)
    .where(eq(classGroups.code, DEV_CLASS.code))
    .get();
}

async function seedStudent(classGroupId: number) {
  await db.insert(students)
    .values({
      ...DEV_STUDENT,
      classGroupId,
    })
    .onConflictDoUpdate({
      target: students.studentNo,
      set: {
        name: DEV_STUDENT.name,
        campusEmail: DEV_STUDENT.campusEmail,
        classGroupId,
        status: 'active',
        updatedAt: new Date(),
      },
    });

  return db
    .select()
    .from(students)
    .where(eq(students.studentNo, DEV_STUDENT.studentNo))
    .get();
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

  return db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.username, DEV_ADMIN.username))
    .get();
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
      source: slugSource(),
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
        source: slugSource(),
        updatedAt: new Date(),
      },
    });

  return db
    .select()
    .from(articles)
    .where(eq(articles.slug, DEV_ARTICLE.slug))
    .get();
}

async function seedCampaign() {
  await db.insert(campaigns)
    .values({
      ...DEV_CAMPAIGN,
      mode: 'exam',
      status: 'active',
      durationSeconds: 180,
      articleStrategy: 'fixed',
      allowRetry: true,
      maxAttemptsPerStudent: 99,
      rankingVisibility: 'public',
    })
    .onConflictDoNothing();

  return db
    .select()
    .from(campaigns)
    .where(eq(campaigns.name, DEV_CAMPAIGN.name))
    .get();
}

async function linkCampaignArticle(campaignId: number, articleId: number, adminUserId: number) {
  await db.insert(campaignArticles)
    .values({
      campaignId,
      articleId,
      sortOrder: 1,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [campaignArticles.campaignId, campaignArticles.articleId],
      set: {
        sortOrder: 1,
        isActive: true,
        updatedAt: new Date(),
      },
    });

  const exists = await db
    .select()
    .from(campaignCurrentArticles)
    .where(eq(campaignCurrentArticles.campaignId, campaignId))
    .get();

  if (!exists) {
    await db.insert(campaignCurrentArticles)
      .values({
        campaignId,
        articleId,
        reason: 'manual',
        resolvedByAdminUserId: adminUserId,
      });
  }
}

async function main() {
  const classGroup = await seedClassGroup();

  if (!classGroup) {
    throw new Error('Failed to seed development class group.');
  }

  const admin = await seedAdmin();
  const student = await seedStudent(classGroup.id);
  const article = await seedArticle();
  const campaign = await seedCampaign();

  if (!admin || !student || !article || !campaign) {
    throw new Error('Failed to seed development identities or campaign.');
  }

  await linkCampaignArticle(campaign.id, article.id, admin.id);

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
  console.log('');
  console.log('Default campaign');
  console.log(`- campaign: ${campaign.name}`);
  console.log(`- article: ${article.title}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
