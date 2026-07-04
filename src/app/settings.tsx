import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { saveSettings } from '@/store/settingsSlice';

export default function SettingsScreen() {
  const settings = useAppSelector((s) => s.settings);
  // Formularen initialiseres fra gemte indstillinger — vent på hydrering fra SQLite
  if (settings.status !== 'ready') return <ThemedView style={styles.screen} />;
  return (
    <SettingsForm
      initialNormHours={String(settings.weeklyNormMinutes / 60).replace('.', ',')}
      initialEmploymentStart={settings.employmentStart ?? ''}
      initialFeriefridage={String(settings.feriefridageDays).replace('.', ',')}
    />
  );
}

function SettingsForm(props: {
  initialNormHours: string;
  initialEmploymentStart: string;
  initialFeriefridage: string;
}) {
  const theme = useTheme();
  const dispatch = useAppDispatch();

  const [normHours, setNormHours] = useState(props.initialNormHours);
  const [employmentStart, setEmploymentStart] = useState(props.initialEmploymentStart);
  const [feriefridage, setFeriefridage] = useState(props.initialFeriefridage);
  const [saved, setSaved] = useState(false);

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
  ];

  const save = async () => {
    const hours = Number(normHours.replace(',', '.'));
    if (!Number.isFinite(hours) || hours <= 0 || hours > 100) {
      Alert.alert('Ugyldig ugenorm', 'Angiv timer pr. uge, fx 37.');
      return;
    }
    if (employmentStart && !/^\d{4}-\d{2}-\d{2}$/.test(employmentStart)) {
      Alert.alert('Ugyldig dato', 'Brug formatet ÅÅÅÅ-MM-DD, fx 2024-03-01.');
      return;
    }
    const ff = Number(feriefridage.replace(',', '.'));
    if (!Number.isFinite(ff) || ff < 0 || ff > 30) {
      Alert.alert('Ugyldigt antal feriefridage', 'Angiv et tal mellem 0 og 30.');
      return;
    }
    await dispatch(
      saveSettings({
        weeklyNormMinutes: Math.round(hours * 60),
        employmentStart: employmentStart || null,
        feriefridageDays: ff,
      }),
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText style={styles.screenTitle}>Indstillinger</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Grundlaget for dine saldi
          </ThemedText>
        </View>

        <ThemedView type="surface" style={[styles.panel, { borderColor: theme.border }]}>
          <Field
            label="Ugenorm, timer"
            hint="Din kontraktlige arbejdstid pr. uge — typisk 37. Flekssaldoen måles mod norm/5 pr. hverdag.">
            <TextInput
              style={[...inputStyle, styles.tabular]}
              value={normHours}
              onChangeText={setNormHours}
              keyboardType="numeric"
            />
          </Field>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Field
            label="Ansættelsesdato"
            hint="Bruges til ferieoptjening: 2,08 dage pr. måned efter ferieloven.">
            <TextInput
              style={[...inputStyle, styles.tabular]}
              value={employmentStart}
              onChangeText={setEmploymentStart}
              placeholder="ÅÅÅÅ-MM-DD"
              placeholderTextColor={theme.textSecondary}
            />
          </Field>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Field
            label="Feriefridage pr. år"
            hint="Ikke lovbestemte — antallet afhænger af din overenskomst (typisk 5, tildeles 1. september).">
            <TextInput
              style={[...inputStyle, styles.tabular]}
              value={feriefridage}
              onChangeText={setFeriefridage}
              keyboardType="numeric"
            />
          </Field>
        </ThemedView>

        <Pressable onPress={save} style={({ pressed }) => pressed && styles.pressed}>
          <View style={[styles.saveButton, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {saved ? 'Indstillinger gemt' : 'Gem indstillinger'}
            </ThemedText>
          </View>
        </Pressable>

        <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
          Flekssaldoen er vejledende. Regler for overarbejde — sats og afspadsering — er ikke
          lovbestemte, men følger af din overenskomst eller kontrakt. Alle data bliver på din
          telefon.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
      <ThemedText type="small" themeColor="textSecondary">
        {hint}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.three,
  },
  header: { marginTop: Spacing.five, gap: 2 },
  screenTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  panel: { borderRadius: 12, borderWidth: 1, padding: Spacing.three },
  field: { gap: 6 },
  divider: { height: 1, marginVertical: Spacing.three },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  saveButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  pressed: { opacity: 0.85 },
  disclaimer: { paddingHorizontal: Spacing.one },
});
