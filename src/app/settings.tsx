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
      initialNormHours={String(settings.weeklyNormMinutes / 60)}
      initialEmploymentStart={settings.employmentStart ?? ''}
      initialFeriefridage={String(settings.feriefridageDays)}
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

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

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
        <ThemedText type="subtitle" style={styles.heading}>
          Indstillinger
        </ThemedText>

        <Field label="Ugenorm (timer)" hint="Din kontraktlige arbejdstid pr. uge — typisk 37.">
          <TextInput
            style={inputStyle}
            value={normHours}
            onChangeText={setNormHours}
            keyboardType="numeric"
          />
        </Field>

        <Field
          label="Ansættelsesdato"
          hint="Bruges til ferieoptjening (2,08 dage pr. måned, ferieloven).">
          <TextInput
            style={inputStyle}
            value={employmentStart}
            onChangeText={setEmploymentStart}
            placeholder="ÅÅÅÅ-MM-DD"
            placeholderTextColor={theme.textSecondary}
          />
        </Field>

        <Field
          label="Feriefridage pr. år"
          hint="Ikke lovbestemt — antallet afhænger af din overenskomst (typisk 5, tildeles 1/9).">
          <TextInput
            style={inputStyle}
            value={feriefridage}
            onChangeText={setFeriefridage}
            keyboardType="numeric"
          />
        </Field>

        <Pressable onPress={save}>
          <ThemedView type="backgroundSelected" style={styles.saveButton}>
            <ThemedText type="smallBold">{saved ? 'Gemt ✓' : 'Gem'}</ThemedText>
          </ThemedView>
        </Pressable>

        <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
          Flekssaldoen er vejledende: overarbejdsregler (sats og afspadsering) er ikke lovbestemte,
          men følger af din overenskomst eller kontrakt.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
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
  content: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.six, gap: Spacing.three },
  heading: { marginTop: Spacing.five },
  field: { gap: Spacing.one },
  input: { borderRadius: Spacing.two, padding: Spacing.two + 2, fontSize: 14 },
  saveButton: { borderRadius: Spacing.two, padding: Spacing.two + 2, alignItems: 'center' },
  disclaimer: { marginTop: Spacing.two },
});
