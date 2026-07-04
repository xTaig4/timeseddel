# Design

Seed system for Timeseddel (React Native / Expo, Android-first). Colors ship as hex (RN requirement) but were composed as OKLCH ramps around a Nordic steel-blue anchor.

## Theme

Light default, full dark support, system-driven. Scene: end-of-day logging on a phone, varied ambient light — light theme is the primary screenshot surface.

## Color

Strategy: **Restrained.** Cool-tinted neutrals + one blue accent for actions/selection/state. Semantic green/red reserved for the flex balance sign and destructive actions.

Light:
- `background` #F6F7F9 (cool near-white body)
- `surface` #FFFFFF (cards, inputs)
- `backgroundElement` #EDF0F4 / `backgroundSelected` #DEE4EC
- `text` #16191E · `textSecondary` #566070 (≥4.5:1 on all surfaces)
- `accent` #2D5FA8 · `accentSoft` #E3EBF6 (selection tint)
- `positive` #23694B · `negative` #A93F39
- `border` #E1E5EB

Dark:
- `background` #0F1114 · `surface` #191C21
- `backgroundElement` #21252C · `backgroundSelected` #2C323B
- `text` #F1F3F6 · `textSecondary` #A2ABB8
- `accent` #8FB4E8 · `accentSoft` #223349
- `positive` #7CC4A0 · `negative` #E39089
- `border` #2A2F37

## Typography

One family: the Android system sans (Roboto). Scale ratio ~1.2: 13 (small/labels), 15 (body), 17 (emphasized), 22 (screen title), 30 (balance figure). All times, durations, and balances use `fontVariant: ['tabular-nums']` and right-alignment.

## Components

- **Balance panel**: flat surface card; flex balance as the leading figure with sign-colored value, ferie/feriefridage as labeled rows beneath. No gradients, no icons-for-decoration.
- **Segmented type selector**: pill chips in a row; selected = accentSoft fill + accent text; unselected = element fill + secondary text.
- **Inputs**: surface fill, 1px border, 10px radius, label above in small/secondary.
- **Primary button**: accent fill, white text, 12px radius, full width. Pressed = 85% opacity. One per screen.
- **List rows**: date column (fixed width, smallBold), detail column, right-aligned duration in tabular nums; 1px hairline separators on surface, not cards-in-cards.
- **Empty state**: one Danish sentence + the action hint, secondary color.

## Motion

150–200 ms, state-conveying only (press feedback, list insert). No entrance choreography.

## Spacing & Shape

Existing scale (4/8/16/24/32/64) retained. Radius: 10 inputs, 12 buttons/cards, 999 chips. Hairline borders over shadows; max one elevation level.
