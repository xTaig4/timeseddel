import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as repo from '@/db/repo';
import type { SettingsRow } from '@/db/schema';

interface SettingsState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  weeklyNormMinutes: number;
  employmentStart: string | null;
  feriefridageDays: number;
  error?: string;
}

const initialState: SettingsState = {
  status: 'idle',
  weeklyNormMinutes: 2220,
  employmentStart: null,
  feriefridageDays: 0,
};

export const loadSettings = createAsyncThunk('settings/load', () => repo.getSettings());

export const saveSettings = createAsyncThunk(
  'settings/save',
  (patch: Partial<Omit<SettingsRow, 'id'>>) => repo.saveSettings(patch),
);

function apply(state: SettingsState, row: SettingsRow) {
  state.status = 'ready';
  state.weeklyNormMinutes = row.weeklyNormMinutes;
  state.employmentStart = row.employmentStart;
  state.feriefridageDays = row.feriefridageDays;
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadSettings.fulfilled, (state, action) => apply(state, action.payload))
      .addCase(loadSettings.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message;
      })
      .addCase(saveSettings.fulfilled, (state, action) => apply(state, action.payload));
  },
});

export default settingsSlice.reducer;
