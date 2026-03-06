import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const articleLanguageValues = ['en', 'zh'] as const;
const articleStatusValues = ['draft', 'published', 'archived'] as const;
const adminRoleValues = ['admin', 'teacher'] as const;
const adminStatusValues = ['active', 'inactive'] as const;
const studentStatusValues = ['active', 'inactive'] as const;
const campaignModeValues = ['practice', 'exam'] as const;
const campaignStatusValues = ['draft', 'scheduled', 'active', 'closed', 'archived'] as const;
const articleStrategyValues = ['fixed', 'daily_random', 'shuffle_once'] as const;
const rankingVisibilityValues = ['public', 'class_only', 'hidden'] as const;
const attemptStatusValues = ['started', 'submitted', 'expired', 'cancelled', 'invalidated'] as const;
const sessionUserTypeValues = ['student', 'admin'] as const;
const auditActorTypeValues = ['student', 'admin', 'system'] as const;
const currentArticleReasonValues = ['manual', 'daily_random', 'shuffle_once'] as const;

const timestamps = () => ({
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const classGroups = sqliteTable(
  'class_groups',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    gradeYear: integer('grade_year').notNull(),
    department: text('department').notNull(),
    major: text('major').notNull(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('class_groups_code_unique').on(table.code),
    index('class_groups_grade_year_idx').on(table.gradeYear),
    index('class_groups_department_major_idx').on(table.department, table.major),
  ],
);

export const students = sqliteTable(
  'students',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentNo: text('student_no').notNull(),
    name: text('name').notNull(),
    campusEmail: text('campus_email').notNull(),
    classGroupId: integer('class_group_id').references(() => classGroups.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    status: text('status', { enum: studentStatusValues }).notNull().default('active'),
    notes: text('notes'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('students_student_no_unique').on(table.studentNo),
    uniqueIndex('students_campus_email_unique').on(table.campusEmail),
    index('students_class_group_id_idx').on(table.classGroupId),
    index('students_name_idx').on(table.name),
    check(
      'students_campus_email_ucass_check',
      sql`lower(${table.campusEmail}) like '%@ucass.edu.cn'`,
    ),
  ],
);

export const adminUsers = sqliteTable(
  'admin_users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role', { enum: adminRoleValues }).notNull().default('admin'),
    status: text('status', { enum: adminStatusValues }).notNull().default('active'),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('admin_users_username_unique').on(table.username),
    index('admin_users_status_idx').on(table.status),
  ],
);

export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    language: text('language', { enum: articleLanguageValues }).notNull().default('en'),
    contentRaw: text('content_raw').notNull(),
    contentNormalized: text('content_normalized').notNull(),
    charCount: integer('char_count').notNull().default(0),
    wordCount: integer('word_count').notNull().default(0),
    difficultyLevel: integer('difficulty_level').notNull().default(1),
    status: text('status', { enum: articleStatusValues }).notNull().default('draft'),
    source: text('source'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('articles_slug_unique').on(table.slug),
    index('articles_language_status_idx').on(table.language, table.status),
    index('articles_title_idx').on(table.title),
  ],
);

export const campaigns = sqliteTable(
  'campaigns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    academicYear: text('academic_year').notNull(),
    term: text('term').notNull(),
    mode: text('mode', { enum: campaignModeValues }).notNull().default('exam'),
    status: text('status', { enum: campaignStatusValues }).notNull().default('draft'),
    durationSeconds: integer('duration_seconds').notNull().default(180),
    articleStrategy: text('article_strategy', { enum: articleStrategyValues })
      .notNull()
      .default('fixed'),
    allowRetry: integer('allow_retry', { mode: 'boolean' }).notNull().default(false),
    maxAttemptsPerStudent: integer('max_attempts_per_student').notNull().default(1),
    rankingVisibility: text('ranking_visibility', { enum: rankingVisibilityValues })
      .notNull()
      .default('public'),
    startAt: integer('start_at', { mode: 'timestamp_ms' }),
    endAt: integer('end_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (table) => [
    index('campaigns_status_idx').on(table.status),
    index('campaigns_academic_year_term_idx').on(table.academicYear, table.term),
    check(
      'campaigns_duration_seconds_positive_check',
      sql`${table.durationSeconds} > 0`,
    ),
    check(
      'campaigns_max_attempts_positive_check',
      sql`${table.maxAttemptsPerStudent} > 0`,
    ),
  ],
);

export const campaignArticles = sqliteTable(
  'campaign_articles',
  {
    campaignId: integer('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(1),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.campaignId, table.articleId] }),
    index('campaign_articles_campaign_sort_idx').on(table.campaignId, table.sortOrder),
  ],
);

export const campaignCurrentArticles = sqliteTable(
  'campaign_current_articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    campaignId: integer('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    resolvedDate: text('resolved_date'),
    resolvedByAdminUserId: integer('resolved_by_admin_user_id').references(() => adminUsers.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    reason: text('reason', { enum: currentArticleReasonValues }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('campaign_current_articles_campaign_idx').on(table.campaignId),
    index('campaign_current_articles_resolved_date_idx').on(table.resolvedDate),
  ],
);

export const attempts = sqliteTable(
  'attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    campaignId: integer('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    classGroupId: integer('class_group_id').references(() => classGroups.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    attemptNo: integer('attempt_no').notNull().default(1),
    status: text('status', { enum: attemptStatusValues }).notNull().default('started'),
    studentNoSnapshot: text('student_no_snapshot').notNull(),
    studentNameSnapshot: text('student_name_snapshot').notNull(),
    campusEmailSnapshot: text('campus_email_snapshot').notNull(),
    articleTitleSnapshot: text('article_title_snapshot').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }),
    durationSecondsAllocated: integer('duration_seconds_allocated').notNull(),
    durationSecondsUsed: integer('duration_seconds_used'),
    typedTextRaw: text('typed_text_raw').notNull().default(''),
    typedTextNormalized: text('typed_text_normalized').notNull().default(''),
    charCountTyped: integer('char_count_typed').notNull().default(0),
    charCountCorrect: integer('char_count_correct').notNull().default(0),
    charCountError: integer('char_count_error').notNull().default(0),
    backspaceCount: integer('backspace_count').notNull().default(0),
    pasteCount: integer('paste_count').notNull().default(0),
    suspicionFlags: text('suspicion_flags', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    clientMeta: text('client_meta', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull()
      .$defaultFn(() => ({})),
    scoreKpm: real('score_kpm').notNull().default(0),
    accuracy: real('accuracy').notNull().default(0),
    scoreVersion: text('score_version').notNull().default('v1'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('attempts_campaign_student_attempt_no_unique').on(
      table.campaignId,
      table.studentId,
      table.attemptNo,
    ),
    index('attempts_campaign_idx').on(table.campaignId),
    index('attempts_campaign_status_idx').on(table.campaignId, table.status),
    index('attempts_student_idx').on(table.studentId),
    index('attempts_class_group_idx').on(table.classGroupId),
    index('attempts_submitted_at_idx').on(table.submittedAt),
    check(
      'attempts_duration_seconds_allocated_positive_check',
      sql`${table.durationSecondsAllocated} > 0`,
    ),
    check('attempts_attempt_no_positive_check', sql`${table.attemptNo} > 0`),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userType: text('user_type', { enum: sessionUserTypeValues }).notNull(),
    userId: integer('user_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: text('metadata', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull()
      .$defaultFn(() => ({})),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_lookup_idx').on(table.userType, table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    actorType: text('actor_type', { enum: auditActorTypeValues }).notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    payload: text('payload', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull()
      .$defaultFn(() => ({})),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('audit_logs_actor_idx').on(table.actorType, table.actorId),
    index('audit_logs_target_idx').on(table.targetType, table.targetId),
    index('audit_logs_action_idx').on(table.action),
  ],
);

export const classGroupsRelations = relations(classGroups, ({ many }) => ({
  students: many(students),
  attempts: many(attempts),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  classGroup: one(classGroups, {
    fields: [students.classGroupId],
    references: [classGroups.id],
  }),
  attempts: many(attempts),
}));

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  resolvedCurrentArticles: many(campaignCurrentArticles),
}));

export const articlesRelations = relations(articles, ({ many }) => ({
  campaignArticles: many(campaignArticles),
  currentAssignments: many(campaignCurrentArticles),
  attempts: many(attempts),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  articles: many(campaignArticles),
  currentArticleHistory: many(campaignCurrentArticles),
  attempts: many(attempts),
}));

export const campaignArticlesRelations = relations(campaignArticles, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignArticles.campaignId],
    references: [campaigns.id],
  }),
  article: one(articles, {
    fields: [campaignArticles.articleId],
    references: [articles.id],
  }),
}));

export const campaignCurrentArticlesRelations = relations(campaignCurrentArticles, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignCurrentArticles.campaignId],
    references: [campaigns.id],
  }),
  article: one(articles, {
    fields: [campaignCurrentArticles.articleId],
    references: [articles.id],
  }),
  resolvedByAdminUser: one(adminUsers, {
    fields: [campaignCurrentArticles.resolvedByAdminUserId],
    references: [adminUsers.id],
  }),
}));

export const attemptsRelations = relations(attempts, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [attempts.campaignId],
    references: [campaigns.id],
  }),
  student: one(students, {
    fields: [attempts.studentId],
    references: [students.id],
  }),
  classGroup: one(classGroups, {
    fields: [attempts.classGroupId],
    references: [classGroups.id],
  }),
  article: one(articles, {
    fields: [attempts.articleId],
    references: [articles.id],
  }),
}));

export type ClassGroup = typeof classGroups.$inferSelect;
export type NewClassGroup = typeof classGroups.$inferInsert;
export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignArticle = typeof campaignArticles.$inferSelect;
export type NewCampaignArticle = typeof campaignArticles.$inferInsert;
export type CampaignCurrentArticle = typeof campaignCurrentArticles.$inferSelect;
export type NewCampaignCurrentArticle = typeof campaignCurrentArticles.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
