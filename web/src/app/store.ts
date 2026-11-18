import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../api/baseApi';
import {
  persistSession,
  sessionReducer,
} from '../features/session/sessionSlice';

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
});

store.subscribe(() => persistSession(store.getState().session));

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
