import { desc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import * as repo from '@/db/repo';
import { toDayEntry } from '@/db/repo';
import { workEntries, type WorkEntryRow } from '@/db/schema';
import {
  daysTaken,
  ferieYearEnd,
  ferieYearStart,
  flexBalanceMinutes,
  vacationDaysEarned,
  type EntryType,
} from '@/domain/accrual';
import { useTheme } from '@/hooks/use-theme';
import { useAppSelector } from '@/store/hooks';
import {
  formatDays,
  formatFlex,
  formatShortDate,
  localToday,
  parseHHMM,
  toHHMM,
} from '@/utils/format';

const TYPE_LABELS: Record<EntryType, string> = {
  work: 'Arbejde',
  vacation: 'Ferie',
  feriefridag: 'Feriefridag',
  sick: 'Sygdom',
  holiday: 'Helligdag',
};

export default function TimerScreen() {
  const { data: rows } = useLiveQuery(
    db.select().from(workEntries).orderBy(desc(workEntries.date), desc(workEntries.id)).limit(50),
  );
  const settings = useAppSelector((s) => s.settings);

  const entries = (rows ?? []).map(toDayEntry);
  const today = localToday();
  const fyStart = ferieYearStart(today);
  const fyEnd = ferieYearEnd(today);

  const flex = flexBalanceMinutes(entries, settings.weeklyNormMinutes);
  const earned = settings.employmentStart
    ? vacationDaysEarned(settings.employmentStart, today)
    : null;
  const ferieUsed = daysTaken(entries, 'vacation', fyStart, fyEnd);
  const ffUsed = daysTaken(entries, 'feriefridag', fyStart, fyEnd);

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        data={rows ?? []}
        keyExtractor={(row) => String(row.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <ThemedText type="subtitle" style={styles.heading}>
              Timeseddel
            </ThemedText>
            <BalanceCard
              flex={flex}
              earned={earned}
              ferieUsed={ferieUsed}
              ffTotal={settings.feriefridageDays}
              ffUsed={ffUsed}
            />
            <EntryForm />
            <ThemedText type="smallBold" style={styles.listHeading}>
              Seneste registreringer
            </ThemedText>
          </>
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary">Ingen registreringer endnu.</ThemedText>
        }
        renderItem={({ item }) => <EntryRow row={item} />}
      />
    </ThemedView>
  );
}

function BalanceCard(props: {
  flex: number;
  earned: number | null;
  ferieUsed: number;
  ffTotal: number;
  ffUsed: number;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <BalanceRow label="Flekssaldo" value={formatFlex(props.flex)} />
      {props.earned == null ? (
        <ThemedText type="small" themeColor="textSecondary">
          Angiv ansættelsesdato under Indstillinger for at se ferieoptjening.
        </ThemedText>
      ) : (
        <BalanceRow
          label="Ferie (i år)"
          value={`${formatDays(props.earned)} optjent · ${props.ferieUsed} brugt · ${formatDays(
            Math.max(0, props.earned - props.ferieUsed),
          )} tilbage`}
        />
      )}
      {props.ffTotal > 0 && (
        <BalanceRow
          label="Feriefridage"
          value={`${formatDays(props.ffTotal)} · ${props.ffUsed} brugt`}
        />
      )}
    </ThemedView>
  );
}

function BalanceRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.balanceRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

function EntryForm() {
  const theme = useTheme();
  const [type, setType] = useState<EntryType>('work');
  const [date, setDate] = useState(localToday());
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('16:00');
  const [breakMin, setBreakMin] = useState('30');
  const [note, setNote] = useState('');

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement },
  ];

  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Ugyldig dato', 'Brug formatet ÅÅÅÅ-MM-DD.');
      return;
    }
    if (type === 'work') {
      const startMinutes = parseHHMM(start);
      const endMinutes = parseHHMM(end);
      const breakMinutes = Number(breakMin) || 0;
      if (startMinutes == null || endMinutes == null) {
        Alert.alert('Ugyldigt tidspunkt', 'Brug formatet TT:MM, fx 08:00.');
        return;
      }
      await repo.addEntry({ date, type, startMinutes, endMinutes, breakMinutes, note: note || null });
    } else {
      await repo.addEntry({ date, type, note: note || null });
    }
    setNote('');
  };

  return (
    <View style={styles.form}>
      <View style={styles.typeRow}>
        {(Object.keys(TYPE_LABELS) as EntryType[]).map((t) => (
          <Pressable key={t} onPress={() => setType(t)}>
            <ThemedView
              type={type === t ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.typeChip}>
              <ThemedText type="small" themeColor={type === t ? 'text' : 'textSecondary'}>
                {TYPE_LABELS[t]}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={inputStyle}
        value={date}
        onChangeText={setDate}
        placeholder="ÅÅÅÅ-MM-DD"
        placeholderTextColor={theme.textSecondary}
      />
      {type === 'work' && (
        <View style={styles.timeRow}>
          <TextInput
            style={[...inputStyle, styles.timeInput]}
            value={start}
            onChangeText={setStart}
            placeholder="Start"
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[...inputStyle, styles.timeInput]}
            value={end}
            onChangeText={setEnd}
            placeholder="Slut"
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[...inputStyle, styles.timeInput]}
            value={breakMin}
            onChangeText={setBreakMin}
            placeholder="Pause (min)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />
        </View>
      )}
      <TextInput
        style={inputStyle}
        value={note}
        onChangeText={setNote}
        placeholder="Note (valgfri)"
        placeholderTextColor={theme.textSecondary}
      />
      <Pressable onPress={save}>
        <ThemedView type="backgroundSelected" style={styles.saveButton}>
          <ThemedText type="smallBold">Registrér</ThemedText>
        </ThemedView>
      </Pressable>
    </View>
  );
}

function EntryRow({ row }: { row: WorkEntryRow }) {
  const detail =
    row.type === 'work' && row.startMinutes != null && row.endMinutes != null
      ? `${toHHMM(row.startMinutes)}–${toHHMM(row.endMinutes)}${
          row.breakMinutes ? ` (${row.breakMinutes} min pause)` : ''
        }`
      : TYPE_LABELS[row.type];

  const remove = () => {
    Alert.alert('Slet registrering?', `${formatShortDate(row.date)} · ${detail}`, [
      { text: 'Annullér', style: 'cancel' },
      { text: 'Slet', style: 'destructive', onPress: () => repo.deleteEntry(row.id) },
    ]);
  };

  return (
    <ThemedView type="backgroundElement" style={styles.entryRow}>
      <ThemedText type="smallBold" style={styles.entryDate}>
        {formatShortDate(row.date)}
      </ThemedText>
      <View style={styles.entryDetail}>
        <ThemedText type="small">{row.type === 'work' ? detail : TYPE_LABELS[row.type]}</ThemedText>
        {row.note ? (
          <ThemedText type="small" themeColor="textSecondary">
            {row.note}
          </ThemedText>
        ) : null}
      </View>
      <Pressable onPress={remove} hitSlop={8}>
        <ThemedText type="small" themeColor="textSecondary">
          Slet
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.six, gap: Spacing.two },
  heading: { marginTop: Spacing.five, marginBottom: Spacing.two },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  form: { gap: Spacing.two, marginTop: Spacing.three },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  typeChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  input: { borderRadius: Spacing.two, padding: Spacing.two + 2, fontSize: 14 },
  timeRow: { flexDirection: 'row', gap: Spacing.two },
  timeInput: { flex: 1 },
  saveButton: {
    borderRadius: Spacing.two,
    padding: Spacing.two + 2,
    alignItems: 'center',
  },
  listHeading: { marginTop: Spacing.three },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.two,
    padding: Spacing.two + 2,
  },
  entryDate: { width: 48 },
  entryDetail: { flex: 1, gap: 2 },
});
