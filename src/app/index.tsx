import { desc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

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
  workedMinutes,
  type EntryType,
} from '@/domain/accrual';
import { parseVoiceCommand } from '@/domain/voiceParse';
import { voiceProbe } from '@/voice/native';
import { useTheme } from '@/hooks/use-theme';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { useAppSelector } from '@/store/hooks';
import {
  formatDays,
  formatFlex,
  formatShortDate,
  isoWeek,
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

const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
const MONTHS = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

function danishToday(): string {
  const now = new Date();
  return `${WEEKDAYS[now.getDay()]} ${now.getDate()}. ${MONTHS[now.getMonth()]}`;
}

/** Dagens dato forskudt med et antal dage, som YYYY-MM-DD i lokal tid. */
function dateWithOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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
            <View style={styles.header}>
              <ThemedText style={styles.screenTitle}>Timeseddel</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {danishToday()} · uge {isoWeek(localToday())}
              </ThemedText>
            </View>
            <BalancePanel
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
        ListEmptyComponent={<EmptyState />}
        renderItem={({ item, index }) => (
          <EntryRow row={item} isFirst={index === 0} isLast={index === (rows?.length ?? 0) - 1} />
        )}
      />
    </ThemedView>
  );
}

function BalancePanel(props: {
  flex: number;
  earned: number | null;
  ferieUsed: number;
  ffTotal: number;
  ffUsed: number;
}) {
  const theme = useTheme();
  const flexColor = props.flex > 0 ? theme.positive : props.flex < 0 ? theme.negative : theme.text;

  return (
    <ThemedView type="surface" style={[styles.panel, { borderColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        Flekssaldo
      </ThemedText>
      <ThemedText style={[styles.flexFigure, { color: flexColor }]}>
        {formatFlex(props.flex)}
        <ThemedText style={styles.flexUnit} themeColor="textSecondary">
          {'  '}timer
        </ThemedText>
      </ThemedText>

      <View style={[styles.panelDivider, { backgroundColor: theme.border }]} />

      {props.earned == null ? (
        <ThemedText type="small" themeColor="textSecondary">
          Angiv din ansættelsesdato under Indstillinger, så beregnes din ferieoptjening automatisk.
        </ThemedText>
      ) : (
        <StatRow
          label="Ferie i år"
          value={`${formatDays(Math.max(0, props.earned - props.ferieUsed))} dage tilbage`}
          detail={`${formatDays(props.earned)} optjent · ${props.ferieUsed} brugt`}
        />
      )}
      {props.ffTotal > 0 && (
        <StatRow
          label="Feriefridage"
          value={`${formatDays(Math.max(0, props.ffTotal - props.ffUsed))} tilbage`}
          detail={`${formatDays(props.ffTotal)} pr. år · ${props.ffUsed} brugt`}
        />
      )}
    </ThemedView>
  );
}

function StatRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View style={styles.statRow}>
      <View style={styles.statLabels}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="smallBold" style={styles.tabular}>
          {value}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.tabular}>
        {detail}
      </ThemedText>
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
  const [voiceHint, setVoiceHint] = useState<string | null>(null);

  // Stemmekommando → udfyld formularen (aldrig auto-gem; brugeren trykker selv gem).
  const voice = useVoiceInput((finalTranscript) => {
    const cmd = parseVoiceCommand(finalTranscript);
    if (!cmd.matched) {
      setVoiceHint('Forstod ikke kommandoen. Prøv fx: "arbejde fra 8 til 16 med 30 minutters pause".');
      return;
    }
    setVoiceHint(null);
    if (cmd.type) setType(cmd.type);
    if (cmd.startMin != null) setStart(toHHMM(cmd.startMin));
    if (cmd.endMin != null) setEnd(toHHMM(cmd.endMin));
    if (cmd.breakMin != null) setBreakMin(String(cmd.breakMin));
    if (cmd.dayOffset != null && cmd.dayOffset !== 0) setDate(dateWithOffset(cmd.dayOffset));
  });

  const voiceActive =
    voice.status === 'starting' || voice.status === 'listening' || voice.status === 'processing';

  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.surface,
      borderColor: theme.border,
    },
  ];

  const startMinutes = parseHHMM(start);
  const endMinutes = parseHHMM(end);
  const previewMinutes =
    type === 'work' && startMinutes != null && endMinutes != null
      ? workedMinutes(startMinutes, endMinutes, Number(breakMin) || 0)
      : null;

  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Ugyldig dato', 'Brug formatet ÅÅÅÅ-MM-DD.');
      return;
    }
    if (type === 'work') {
      if (startMinutes == null || endMinutes == null) {
        Alert.alert('Ugyldigt tidspunkt', 'Brug formatet TT:MM, fx 08:00.');
        return;
      }
      await repo.addEntry({
        date,
        type,
        startMinutes,
        endMinutes,
        breakMinutes: Number(breakMin) || 0,
        note: note || null,
      });
    } else {
      await repo.addEntry({ date, type, note: note || null });
    }
    setNote('');
  };

  return (
    <View style={styles.form}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeScroll}
        contentContainerStyle={styles.typeRow}>
        {(Object.keys(TYPE_LABELS) as EntryType[]).map((t) => {
          const selected = type === t;
          return (
            <Pressable key={t} onPress={() => setType(t)}>
              <View
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: selected ? theme.accentSoft : theme.backgroundElement,
                    borderColor: selected ? theme.accent : 'transparent',
                  },
                ]}>
                <ThemedText
                  type="small"
                  style={{ color: selected ? theme.accent : theme.textSecondary }}>
                  {TYPE_LABELS[t]}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Field label="Dato">
        <TextInput
          style={inputStyle}
          value={date}
          onChangeText={setDate}
          placeholder="ÅÅÅÅ-MM-DD"
          placeholderTextColor={theme.textSecondary}
        />
      </Field>

      {type === 'work' && (
        <View style={styles.timeRow}>
          <Field label="Start" style={styles.timeField}>
            <TextInput
              style={[...inputStyle, styles.tabular]}
              value={start}
              onChangeText={setStart}
              keyboardType="numbers-and-punctuation"
              placeholder="08:00"
              placeholderTextColor={theme.textSecondary}
            />
          </Field>
          <Field label="Slut" style={styles.timeField}>
            <TextInput
              style={[...inputStyle, styles.tabular]}
              value={end}
              onChangeText={setEnd}
              keyboardType="numbers-and-punctuation"
              placeholder="16:00"
              placeholderTextColor={theme.textSecondary}
            />
          </Field>
          <Field label="Pause, min" style={styles.timeField}>
            <TextInput
              style={[...inputStyle, styles.tabular]}
              value={breakMin}
              onChangeText={setBreakMin}
              keyboardType="numeric"
              placeholder="30"
              placeholderTextColor={theme.textSecondary}
            />
          </Field>
        </View>
      )}

      <Field label="Note">
        <TextInput
          style={inputStyle}
          value={note}
          onChangeText={setNote}
          placeholder="Valgfri"
          placeholderTextColor={theme.textSecondary}
        />
      </Field>

      <View style={styles.actionRow}>
        <Pressable
          onPress={save}
          style={({ pressed }) => [styles.saveFlex, pressed && styles.pressed]}>
          <View style={[styles.saveButton, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {previewMinutes != null
                ? `Registrér ${TYPE_LABELS[type].toLowerCase()} · ${formatFlex(previewMinutes).replace('+', '')} timer`
                : `Registrér ${TYPE_LABELS[type].toLowerCase()}`}
            </ThemedText>
          </View>
        </Pressable>

        {voice.status !== 'unavailable' && (
          <Pressable
            onPress={voiceActive ? voice.stop : voice.start}
            onLongPress={() => setVoiceHint(voiceProbe())} // skjult diagnostik til fejlsøgning på enhed
            accessibilityLabel={voiceActive ? 'Stop talegenkendelse' : 'Registrér med stemmen'}
            style={({ pressed }) => pressed && styles.pressed}>
            <View
              style={[
                styles.micButton,
                {
                  backgroundColor: voiceActive ? theme.accent : theme.accentSoft,
                  borderColor: theme.accent,
                },
              ]}>
              <ThemedText style={{ color: voiceActive ? theme.onAccent : theme.accent }}>
                {voiceActive ? '■' : '🎤'}
              </ThemedText>
            </View>
          </Pressable>
        )}
      </View>

      {voiceActive && (
        <View style={styles.voiceStatus}>
          <ThemedText type="small" style={{ color: theme.accent }}>
            Lytter …
          </ThemedText>
          {voice.transcript ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {voice.transcript}
            </ThemedText>
          ) : null}
        </View>
      )}

      {!voiceActive && (voiceHint || voice.error) ? (
        <ThemedText type="small" style={[styles.voiceStatus, { color: theme.negative }]}>
          {voiceHint ?? voice.error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Field({
  label,
  style,
  children,
}: {
  label: string;
  style?: object;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.field, style]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function EntryRow({ row, isFirst, isLast }: { row: WorkEntryRow; isFirst: boolean; isLast: boolean }) {
  const theme = useTheme();
  const isWork = row.type === 'work' && row.startMinutes != null && row.endMinutes != null;
  const duration = isWork
    ? formatFlex(workedMinutes(row.startMinutes!, row.endMinutes!, row.breakMinutes)).replace('+', '')
    : null;

  const remove = () => {
    Alert.alert(
      'Slet registrering?',
      `${formatShortDate(row.date)} · ${isWork ? `${toHHMM(row.startMinutes!)}–${toHHMM(row.endMinutes!)}` : TYPE_LABELS[row.type]}`,
      [
        { text: 'Annullér', style: 'cancel' },
        { text: 'Slet registrering', style: 'destructive', onPress: () => repo.deleteEntry(row.id) },
      ],
    );
  };

  return (
    <Pressable onLongPress={remove} delayLongPress={350}>
      <ThemedView
        type="surface"
        style={[
          styles.entryRow,
          { borderColor: theme.border },
          isFirst && styles.entryRowFirst,
          isLast && styles.entryRowLast,
          !isLast && { borderBottomWidth: 0 },
        ]}>
        <ThemedText type="smallBold" style={[styles.entryDate, styles.tabular]}>
          {formatShortDate(row.date)}
        </ThemedText>
        <View style={styles.entryDetail}>
          <ThemedText type="small">
            {isWork ? `${toHHMM(row.startMinutes!)}–${toHHMM(row.endMinutes!)}` : TYPE_LABELS[row.type]}
            {isWork && row.breakMinutes ? (
              <ThemedText type="small" themeColor="textSecondary">
                {'  '}· {row.breakMinutes} min pause
              </ThemedText>
            ) : null}
          </ThemedText>
          {row.note ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {row.note}
            </ThemedText>
          ) : null}
        </View>
        {duration ? (
          <ThemedText type="smallBold" style={styles.tabular}>
            {duration}
          </ThemedText>
        ) : (
          <View
            style={[
              styles.typeDot,
              { backgroundColor: row.type === 'vacation' || row.type === 'feriefridag' ? theme.accent : theme.textSecondary },
            ]}
          />
        )}
      </ThemedView>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <ThemedText type="small" themeColor="textSecondary">
        Ingen registreringer endnu. Log din første arbejdsdag ovenfor — det tager et kvart minut.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.six },
  header: { marginTop: Spacing.five, marginBottom: Spacing.three, gap: 2 },
  screenTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  panel: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  flexFigure: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  flexUnit: { fontSize: 14, fontWeight: '500' },
  panelDivider: { height: 1, marginVertical: Spacing.two },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: Spacing.one,
  },
  statLabels: { gap: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  form: { gap: Spacing.two, marginTop: Spacing.four },
  typeScroll: { marginHorizontal: -Spacing.three },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.one,
  },
  typeChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  field: { gap: 4 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  timeRow: { flexDirection: 'row', gap: Spacing.two },
  timeField: { flex: 1 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  saveFlex: { flex: 1 },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceStatus: { gap: 2, paddingHorizontal: Spacing.half },
  pressed: { opacity: 0.85 },
  listHeading: { marginTop: Spacing.five, marginBottom: Spacing.two },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
  },
  entryRowFirst: { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  entryRowLast: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  entryDate: { width: 44 },
  entryDetail: { flex: 1, gap: 2 },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  empty: { paddingVertical: Spacing.four },
});
