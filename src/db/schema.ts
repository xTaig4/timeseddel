import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const workEntries = sqliteTable('work_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(), // YYYY-MM-DD
  type: text('type', { enum: ['work', 'vacation', 'feriefridag', 'sick', 'holiday'] })
    .notNull()
    .default('work'),
  startMinutes: integer('start_minutes'), // minutter fra midnat; null for fravær
  endMinutes: integer('end_minutes'),
  breakMinutes: integer('break_minutes').notNull().default(0),
  note: text('note'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(), // altid 1 — én række
  weeklyNormMinutes: integer('weekly_norm_minutes').notNull().default(2220), // 37 t
  employmentStart: text('employment_start'), // YYYY-MM-DD
  feriefridageDays: real('feriefridage_days').notNull().default(0), // overenskomstbestemt
});

export type WorkEntryRow = typeof workEntries.$inferSelect;
export type NewWorkEntry = typeof workEntries.$inferInsert;
export type SettingsRow = typeof settings.$inferSelect;
