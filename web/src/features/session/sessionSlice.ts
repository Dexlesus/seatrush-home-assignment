import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Fan } from '../../api/types';

/**
 * Who is using this tab.
 * - The current fan is kept in sessionStorage, which is per TAB: two browser
 *   windows can be two different fans (the brief tests exactly that).
 * - Recent handles are kept in localStorage, so switching back is one click.
 * Storage can be blocked (private mode), so every access is guarded.
 */
interface SessionState {
  current: Fan | null;
  recent: Fan[];
}

const CURRENT_KEY = 'seatrush.currentFan';
const RECENT_KEY = 'seatrush.recentFans';
const MAX_RECENT = 6;

function read<T>(storage: () => Storage, key: string, fallback: T): T {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(storage: () => Storage, key: string, value: unknown): void {
  try {
    storage().setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the app still works, it just won't remember.
  }
}

const initialState: SessionState = {
  current: read<Fan | null>(() => sessionStorage, CURRENT_KEY, null),
  recent: read<Fan[]>(() => localStorage, RECENT_KEY, []),
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<Fan>) {
      state.current = action.payload;
      state.recent = [
        action.payload,
        ...state.recent.filter((fan) => fan.handle !== action.payload.handle),
      ].slice(0, MAX_RECENT);
    },
    signedOut(state) {
      state.current = null;
    },
  },
});

export const { signedIn, signedOut } = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;

/** Saves the session after every change (called from the store). */
export function persistSession(state: SessionState): void {
  write(() => sessionStorage, CURRENT_KEY, state.current);
  write(() => localStorage, RECENT_KEY, state.recent);
}
