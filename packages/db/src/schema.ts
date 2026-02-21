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
    status: submissionStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    index('submission_assignment_id_idx').on(table.assignmentId),
    index('submission_candidate_id_idx').on(table.candidateId)
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

export const submissionRelations = relations(submissions, ({ one }) => ({
  assignment: one(assignments, {
    fields: [submissions.assignmentId],
    references: [assignments.id]
  }),
  candidate: one(user, {
    fields: [submissions.candidateId],
    references: [user.id]
  })
}))

export const userSelectSchema = createSelectSchema(user)
export const assignmentSelectSchema = createSelectSchema(assignments)
export const submissionSelectSchema = createSelectSchema(submissions)

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
export type NewAssignment = z.infer<typeof createAssignmentSchema>
