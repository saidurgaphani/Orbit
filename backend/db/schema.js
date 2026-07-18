import { pgTable, uuid, text, integer, numeric, date, timestamp, jsonb, uniqueIndex, vector } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  timezone: text('timezone').default('UTC'),
  profileData: jsonb('profile_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const healthRecords = pgTable('health_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  recordedAt: date('recorded_at').notNull(),
  steps: integer('steps').default(0),
  sleepDuration: integer('sleep_duration').default(0), // in minutes
  heartRate: integer('heart_rate').default(72),
  caloriesBurned: integer('calories_burned').default(0),
  distance: integer('distance').default(0), // in meters
  source: text('source').default('manual'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  category: text('category').notNull(),
  description: text('description'),
  transactionDate: date('transaction_date').notNull(),
  paymentMethod: text('payment_method'),
  source: text('source').default('manual'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const goals = pgTable('goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  targetValue: numeric('target_value').notNull(),
  currentValue: numeric('current_value').default('0').notNull(),
  targetDate: date('target_date'),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const habits = pgTable('habits', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  frequency: text('frequency').default('daily').notNull(),
  targetCount: integer('target_count').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const habitLogs = pgTable('habit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  habitId: uuid('habit_id').references(() => habits.id, { onDelete: 'cascade' }).notNull(),
  completedAt: date('completed_at').notNull(),
  status: text('status').default('completed').notNull(),
});

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url'),
  fileType: text('file_type'),
  base64: text('base64'),
  extractedText: text('extracted_text'),
  summary: text('summary'),
  category: text('category').default('Personal').notNull(),
  metadata: jsonb('metadata'),
  issueDate: date('issue_date'),
  expiryDate: date('expiry_date'),
  relatedTypes: jsonb('related_types'),
  aiInsight: text('ai_insight'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const scamAnalyses = pgTable('scam_analyses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  inputText: text('input_text').notNull(),
  inputType: text('input_type').default('text').notNull(),
  riskScore: integer('risk_score').notNull(),
  analysis: text('analysis'),
  detectedSignals: jsonb('detected_signals'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const decisions = pgTable('decisions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  question: text('question').notNull(),
  context: text('context'),
  recommendation: text('recommendation'),
  reasoning: text('reasoning'),
  options: jsonb('options'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const dailyBriefs = pgTable('daily_briefs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  briefDate: date('brief_date').notNull(),
  content: text('content').notNull(),
  lifeScore: integer('life_score').notNull(),
  healthSummary: text('health_summary'),
  financeSummary: text('finance_summary'),
  goalSummary: text('goal_summary'),
  importantEvents: jsonb('important_events'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    userBriefDateIdx: uniqueIndex('user_brief_date_idx').on(table.userId, table.briefDate),
  };
});

export const aiMemories = pgTable('ai_memories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  memoryType: text('memory_type').default('general').notNull(),
  content: text('content').notNull(),
  importance: integer('importance').default(1).notNull(),
  source: text('source').default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 768 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

