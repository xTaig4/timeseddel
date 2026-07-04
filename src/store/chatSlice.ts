import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ChatMessage } from '@/ai/client';

interface ChatState {
  messages: ChatMessage[];
  status: 'idle' | 'streaming' | 'error';
  error?: string;
}

const initialState: ChatState = {
  messages: [],
  status: 'idle',
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    sendStarted(state, action: PayloadAction<string>) {
      state.messages.push({ role: 'user', content: action.payload });
      state.messages.push({ role: 'assistant', content: '' });
      state.status = 'streaming';
      state.error = undefined;
    },
    deltaReceived(state, action: PayloadAction<{ index: number; text: string }>) {
      // målrettet på indeks, så en forældet stream aldrig skriver i en ny boble
      const target = state.messages[action.payload.index];
      if (target?.role === 'assistant') target.content += action.payload.text;
    },
    sendFinished(state) {
      state.status = 'idle';
    },
    sendFailed(state, action: PayloadAction<string>) {
      // fjern det tomme assistent-svar, så fejlen ikke ligner et svar
      const last = state.messages[state.messages.length - 1];
      if (last?.role === 'assistant' && last.content === '') state.messages.pop();
      state.status = 'error';
      state.error = action.payload;
    },
    conversationCleared(state) {
      state.messages = [];
      state.status = 'idle';
      state.error = undefined;
    },
  },
});

export const { sendStarted, deltaReceived, sendFinished, sendFailed, conversationCleared } =
  chatSlice.actions;
export default chatSlice.reducer;
