import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

// enableChangeListener kræves for useLiveQuery — uden den opdaterer lister aldrig
const expoDb = openDatabaseSync('timeseddel.db', { enableChangeListener: true });
expoDb.execSync('PRAGMA journal_mode = WAL;');

export const db = drizzle(expoDb, { schema });
