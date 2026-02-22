import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

export const userRoleEnum = pgEnum('user_role', ['employer', 'candidate'])
export const submissionStatusEnum = pgEnum('submission_status', [
  'pending',
  'building',
  'deployed',
  'failed'
])
export const buildRunTriggerEnum = pgEnum('build_run_trigger', ['submission', 'push'])
export const buildRunStatusEnum = pgEnum('build_run_status', [
  'queued',
  'running',
  'deployed',
  'failed'
])
export const aiReportStatusEnum = pgEnum('ai_report_status', ['pending', 'completed', 'failed'])
export const aiReportMessageRoleEnum = pgEnum('ai_report_message_role', ['employer', 'assistant'])
export const buildLogStageEnum = pgEnum('build_log_stage', [
  'system',
  'clone',
  'validate',
  'install',
  'build',
  'deploy',
  'analyze'
])
export const buildLogLevelEnum = pgEnum('build_log_level', ['info', 'warn', 'error'])

export const user = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: userRoleEnum('role').notNull().default('candidate'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
})

export const session = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  (table) => [index('session_user_id_idx').on(table.userId)]
)

export const account = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'date'
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
      mode: 'date'
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex('account_provider_account_unique').on(table.providerId, table.accountId),
    index('account_user_id_idx').on(table.userId)
  ]
)

export const verification = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
})

export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  instructions: text('instructions').notNull(),
  joinCode: text('join_code').notNull().unique(),
  employerId: text('employer_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
})

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    candidateId: text('candidate_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    repositoryUrl: text('repository_url').notNull(),
    repositoryFullName: text('repository_full_name'),
    githubInstallationId: text('github_installation_id'),
    repositoryDefaultBranch: text('repository_default_branch'),
    latestCommitSha: text('latest_commit_sha'),
    deployedUrl: text('deployed_url'),
    lastBuildAt: timestamp('last_build_at', { withTimezone: true, mode: 'date' }),
    status: submissionStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    index('submission_assignment_id_idx').on(table.assignmentId),
    index('submission_candidate_id_idx').on(table.candidateId),
    index('submission_repository_full_name_idx').on(table.repositoryFullName),
    index('submission_github_installation_id_idx').on(table.githubInstallationId)
  ]
)

export const buildRuns = pgTable(
  'build_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    trigger: buildRunTriggerEnum('trigger').notNull(),
    status: buildRunStatusEnum('status').notNull().default('queued'),
    branch: text('branch'),
    commitSha: text('commit_sha'),
    deploymentUrl: text('deployment_url'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    index('build_run_submission_id_idx').on(table.submissionId),
    index('build_run_status_idx').on(table.status),
    index('build_run_created_at_idx').on(table.createdAt)
  ]
)

export const buildLogs = pgTable(
  'build_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    buildRunId: uuid('build_run_id')
      .notNull()
      .references(() => buildRuns.id, { onDelete: 'cascade' }),
    stage: buildLogStageEnum('stage').notNull(),
    level: buildLogLevelEnum('level').notNull().default('info'),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    index('build_log_build_run_id_idx').on(table.buildRunId),
    index('build_log_build_run_created_at_idx').on(table.buildRunId, table.createdAt)
  ]
)

export const aiReports = pgTable(
  'ai_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    buildRunId: uuid('build_run_id').references(() => buildRuns.id, { onDelete: 'set null' }),
    status: aiReportStatusEnum('status').notNull().default('pending'),
    model: text('model'),
    projectOverview: text('project_overview'),
    notableStructure: text('notable_structure'),
    engineeringStrengths: text('engineering_strengths').array().notNull().default([]),
    risksOrConcerns: text('risks_or_concerns').array().notNull().default([]),
    suggestedQuestions: text('suggested_questions').array().notNull().default([]),
    analysisContext: text('analysis_context'),
    rawResponse: text('raw_response'),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    index('ai_report_submission_id_idx').on(table.submissionId),
    index('ai_report_build_run_id_idx').on(table.buildRunId),
    index('ai_report_created_at_idx').on(table.createdAt)
  ]
)

export const aiReportMessages = pgTable(
  'ai_report_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    aiReportId: uuid('ai_report_id')
      .notNull()
      .references(() => aiReports.id, { onDelete: 'cascade' }),
    role: aiReportMessageRoleEnum('role').notNull(),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    index('ai_report_message_report_id_idx').on(table.aiReportId),
    index('ai_report_message_created_at_idx').on(table.createdAt)
  ]
)

export const userRelations = relations(user, ({ many }) => ({
  assignments: many(assignments),
  submissions: many(submissions)
}))

export const assignmentRelations = relations(assignments, ({ one, many }) => ({
  employer: one(user, {
    fields: [assignments.employerId],
    references: [user.id]
  }),
  submissions: many(submissions)
}))

export const submissionRelations = relations(submissions, ({ one, many }) => ({
  assignment: one(assignments, {
    fields: [submissions.assignmentId],
    references: [assignments.id]
  }),
  candidate: one(user, {
    fields: [submissions.candidateId],
    references: [user.id]
  }),
  buildRuns: many(buildRuns)
}))

export const buildRunRelations = relations(buildRuns, ({ one, many }) => ({
  submission: one(submissions, {
    fields: [buildRuns.submissionId],
    references: [submissions.id]
  }),
  logs: many(buildLogs),
  aiReports: many(aiReports)
}))

export const buildLogRelations = relations(buildLogs, ({ one }) => ({
  buildRun: one(buildRuns, {
    fields: [buildLogs.buildRunId],
    references: [buildRuns.id]
  })
}))

export const aiReportRelations = relations(aiReports, ({ one, many }) => ({
  submission: one(submissions, {
    fields: [aiReports.submissionId],
    references: [submissions.id]
  }),
  buildRun: one(buildRuns, {
    fields: [aiReports.buildRunId],
    references: [buildRuns.id]
  }),
  messages: many(aiReportMessages)
}))

export const aiReportMessageRelations = relations(aiReportMessages, ({ one }) => ({
  report: one(aiReports, {
    fields: [aiReportMessages.aiReportId],
    references: [aiReports.id]
  })
}))

export const userSelectSchema = createSelectSchema(user)
export const assignmentSelectSchema = createSelectSchema(assignments)
export const submissionSelectSchema = createSelectSchema(submissions)
export const buildRunSelectSchema = createSelectSchema(buildRuns)
export const buildLogSelectSchema = createSelectSchema(buildLogs)
export const aiReportSelectSchema = createSelectSchema(aiReports)
export const aiReportMessageSelectSchema = createSelectSchema(aiReportMessages)

export const createAssignmentSchema = createInsertSchema(assignments, {
  title: z.string().min(3).max(150),
  instructions: z.string().min(20).max(10_000)
}).omit({
  id: true,
  joinCode: true,
  employerId: true,
  createdAt: true,
  updatedAt: true
})

export type UserRole = (typeof userRoleEnum.enumValues)[number]
export type User = typeof user.$inferSelect
export type Assignment = typeof assignments.$inferSelect
export type Submission = typeof submissions.$inferSelect
export type BuildRun = typeof buildRuns.$inferSelect
export type BuildLog = typeof buildLogs.$inferSelect
export type AiReport = typeof aiReports.$inferSelect
export type AiReportMessage = typeof aiReportMessages.$inferSelect
export type NewAssignment = z.infer<typeof createAssignmentSchema>
