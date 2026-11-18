import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../app/store';

/**
 * One RTK Query API for the whole app. Every request carries the current
 * fan's handle in X-Username (that's how the API knows who is asking).
 * Features add their endpoints with baseApi.injectEndpoints().
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL ?? '/api',
    timeout: 15_000,
    prepareHeaders: (headers, { getState }) => {
      const handle = (getState() as RootState).session.current?.handle;
      if (handle) {
        headers.set('X-Username', handle);
      }
      return headers;
    },
  }),
  tagTypes: ['Events', 'Seats', 'Holds', 'Orders'],
  endpoints: () => ({}),
});
