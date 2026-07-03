import { eq } from 'drizzle-orm';

import { workedMinutes, type DayEntry } from '@/domain/accrual';
import { db } from './client';
import { settings, workEntries, type NewWorkEntry, type SettingsRow, type WorkEntryRow } from './schema';

export async function addEntry(entry: NewWorkEntry): Promise<void> {
  await db.insert(workEntries).values(entry);
}

export async function updateEntry(id: number, entry: Partial<NewWorkEntry>): Promise<void> {
  await db.update(workEntries).set(entry).where(eq(workEntries.id, id));
}

export async function deleteEntry(id: number): Promise<void> {
  await db.delete(workEntries).where(eq(workEntries.id, id));
}

export function toDayEntry(row: WorkEntryRow): DayEntry {
  return {
    date: row.date,
    type: row.type,
    workedMinutes:
      row.type === 'work' && row.startMinutes != null && row.endMinutes != null
        ? workedMinutes(row.startMinutes, row.endMinutes, row.breakMinutes)
        : 0,
  };
}

const DEFAULT_SETTINGS: SettingsRow = {
  id: 1,
  weeklyNormMinutes: 2220,
  employmentStart: null,
  feriefridageDays: 0,
};

export async function getSettings(): Promise<SettingsRow> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1));
  if (rows.length === 0) {
    await db.insert(settings).values(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  return rows[0];
}

export async function saveSettings(patch: Partial<Omit<SettingsRow, 'id'>>): Promise<SettingsRow> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await db.update(settings).set(next).where(eq(settings.id, 1));
  return next;
}
