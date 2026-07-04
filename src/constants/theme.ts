/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#16191E',
    background: '#F6F7F9',
    surface: '#FFFFFF',
    backgroundElement: '#EDF0F4',
    backgroundSelected: '#DEE4EC',
    textSecondary: '#566070',
    accent: '#2D5FA8',
    onAccent: '#FFFFFF',
    accentSoft: '#E3EBF6',
    positive: '#23694B',
    negative: '#A93F39',
    border: '#E1E5EB',
  },
  dark: {
    text: '#F1F3F6',
    background: '#0F1114',
    surface: '#191C21',
    backgroundElement: '#21252C',
    backgroundSelected: '#2C323B',
    textSecondary: '#A2ABB8',
    accent: '#8FB4E8',
    onAccent: '#101828',
    accentSoft: '#223349',
    positive: '#7CC4A0',
    negative: '#E39089',
    border: '#2A2F37',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
