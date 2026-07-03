import * as Sentry from '@sentry/react-native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Provider } from 'react-redux';

import migrations from '../../drizzle/migrations';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/db/client';
import { useAppDispatch } from '@/store/hooks';
import { loadSettings } from '@/store/settingsSlice';
import { store } from '@/store';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
});

SplashScreen.preventAutoHideAsync();

function Root() {
  const colorScheme = useColorScheme();
  const dispatch = useAppDispatch();
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (success) dispatch(loadSettings());
  }, [success, dispatch]);

  if (error) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <ThemedText type="subtitle">Databasefejl</ThemedText>
        <ThemedText>Migrering fejlede: {error.message}</ThemedText>
      </ThemedView>
    );
  }
  if (!success) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}

function TabLayout() {
  return (
    <Provider store={store}>
      <Root />
    </Provider>
  );
}

export default Sentry.wrap(TabLayout);
