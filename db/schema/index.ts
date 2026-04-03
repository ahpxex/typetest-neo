import { relations, sql } from 'drizzle-orm';
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { attemptModeValues } from '@/lib/attempt-mode';

const articleLanguageValues = ['en', 'zh'] as const;
const articleStatusValues = ['draft', 'published', 'archived'] as const;
const adminRoleValues = ['admin', 'teacher'] as const;
const adminStatusValues = ['active', 'inactive'] as const;
const studentStatusValues = ['active', 'inactive'] as const;
const attemptStatusValues = ['started', 'submitted', 'expired', 'cancelled', 'invalidated'] as const;
const sessionUserTypeValues = ['student', 'admin'] as const;
const authAttemptScopeValues = ['student_login', 'admin_login'] as const;

const timestamps = () => ({
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const students = sqliteTable(
  'students',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentNo: text('student_no').notNull(),
    name: text('name').notNull(),
    campusEmail: text('campus_email').notNull(),
    enrollmentYear: text('enrollment_year').notNull(),
    schoolCode: text('school_code').notNull(),
    majorCode: text('major_code').notNull(),
    classSerial: text('class_serial').notNull(),
    passwordHash: text('password_hash'),
    status: text('status', { enum: studentStatusValues }).notNull().default('active'),
    emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp_ms' }),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),
    notes: text('notes'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('students_student_no_unique').on(table.studentNo),
    uniqueIndex('students_campus_email_unique').on(table.campusEmail),
    index('students_name_idx').on(table.name),
    index('students_enrollment_year_idx').on(table.enrollmentYear),
    index('students_school_code_idx').on(table.schoolCode),
    index('students_major_code_idx').on(table.majorCode),
    check(
      'students_campus_email_ucass_check',
      sql`lower(${table.campusEmail}) like '%@ucass.edu.cn'`,
    ),
  ],
);

export const studentEmailVerificationTokens = sqliteTable(
  'student_email_verification_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
    requestIp: text('request_ip'),
    requestUserAgent: text('request_user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('student_email_verification_tokens_token_hash_unique').on(table.tokenHash),
    index('student_email_verification_tokens_student_idx').on(table.studentId),
    index('student_email_verification_tokens_expires_at_idx').on(table.expiresAt),
    index('student_email_verification_tokens_request_ip_created_at_idx').on(table.requestIp, table.createdAt),
  ],
);

export const authLoginAttempts = sqliteTable(
  'auth_login_attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    scope: text('scope', { enum: authAttemptScopeValues }).notNull(),
    identifier: text('identifier').notNull(),
    ipAddress: text('ip_address'),
    wasSuccessful: integer('was_successful', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('auth_login_attempts_scope_identifier_created_at_idx').on(
      table.scope,
      table.identifier,
      table.createdAt,
    ),
    index('auth_login_attempts_scope_ip_created_at_idx').on(
      table.scope,
      table.ipAddress,
      table.createdAt,
    ),
    index('auth_login_attempts_created_at_idx').on(table.createdAt),
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

export const attempts = sqliteTable(
  'attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    mode: text('mode', { enum: attemptModeValues }).notNull().default('exam'),
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
    uniqueIndex('attempts_student_attempt_no_unique').on(table.studentId, table.attemptNo),
    index('attempts_student_idx').on(table.studentId),
    index('attempts_article_idx').on(table.articleId),
    index('attempts_mode_idx').on(table.mode),
    index('attempts_status_idx').on(table.status),
    index('attempts_submitted_at_idx').on(table.submittedAt),
    index('attempts_created_at_idx').on(table.createdAt),
    index('attempts_student_started_lookup_idx').on(
      table.studentId,
      table.mode,
      table.status,
      table.createdAt,
      table.attemptNo,
    ),
    index('attempts_student_started_article_lookup_idx').on(
      table.studentId,
      table.mode,
      table.status,
      table.articleId,
      table.createdAt,
      table.attemptNo,
    ),
    index('attempts_student_snapshot_lookup_idx').on(
      table.studentNoSnapshot,
      table.attemptNo,
      table.createdAt,
    ),
    index('attempts_leaderboard_idx').on(
      table.mode,
      table.status,
      sql`${table.scoreKpm} desc`,
      sql`${table.accuracy} desc`,
      table.submittedAt,
    ),
    check('attempts_duration_seconds_allocated_positive_check', sql`${table.durationSecondsAllocated} > 0`),
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

export const studentsRelations = relations(students, ({ many }) => ({
  attempts: many(attempts),
  emailVerificationTokens: many(studentEmailVerificationTokens),
}));

export const articlesRelations = relations(articles, ({ many }) => ({
  attempts: many(attempts),
}));

export const attemptsRelations = relations(attempts, ({ one }) => ({
  student: one(students, {
    fields: [attempts.studentId],
    references: [students.id],
  }),
  article: one(articles, {
    fields: [attempts.articleId],
    references: [articles.id],
  }),
}));

export const studentEmailVerificationTokensRelations = relations(studentEmailVerificationTokens, ({ one }) => ({
  student: one(students, {
    fields: [studentEmailVerificationTokens.studentId],
    references: [students.id],
  }),
}));

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type StudentEmailVerificationToken = typeof studentEmailVerificationTokens.$inferSelect;
export type NewStudentEmailVerificationToken = typeof studentEmailVerificationTokens.$inferInsert;
export type AuthLoginAttempt = typeof authLoginAttempts.$inferSelect;
export type NewAuthLoginAttempt = typeof authLoginAttempts.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
