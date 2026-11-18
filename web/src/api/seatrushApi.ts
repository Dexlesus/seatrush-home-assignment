import { baseApi } from './baseApi';
import type {
  CreateEventBody,
  EventDetails,
  EventList,
  Fan,
  Hold,
  HoldBody,
  MyHolds,
  Order,
  SeatMap,
} from './types';

/** Every API call the screens make, with cache tags so data stays fresh. */
export const seatrushApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    logIn: build.mutation<Fan, string>({
      query: (name) => ({ url: '/session', method: 'POST', body: { name } }),
    }),

    listEvents: build.query<EventList, void>({
      query: () => '/events',
      providesTags: ['Events'],
    }),

    getEvent: build.query<EventDetails, string>({
      query: (eventId) => `/events/${eventId}`,
      providesTags: (_result, _error, eventId) => [{ type: 'Events', id: eventId }],
    }),

    getSeats: build.query<SeatMap, string>({
      query: (eventId) => `/events/${eventId}/seats`,
      providesTags: (_result, _error, eventId) => [{ type: 'Seats', id: eventId }],
    }),

    myHolds: build.query<MyHolds, void>({
      query: () => '/me/holds',
      providesTags: ['Holds'],
    }),

    /** The Idempotency-Key makes a retry or a double click safe: one hold only. */
    createHold: build.mutation<
      Hold,
      { eventId: string; body: HoldBody; idempotencyKey: string }
    >({
      query: ({ eventId, body, idempotencyKey }) => ({
        url: `/events/${eventId}/holds`,
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      invalidatesTags: (_result, _error, { eventId }) => [
        { type: 'Seats', id: eventId },
        'Holds',
      ],
    }),

    releaseHold: build.mutation<void, { holdId: string; eventId: string }>({
      query: ({ holdId }) => ({ url: `/holds/${holdId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { eventId }) => [
        { type: 'Seats', id: eventId },
        'Holds',
      ],
    }),

    checkout: build.mutation<
      Order,
      { holdId: string; eventId: string; promoCode?: string; idempotencyKey: string }
    >({
      query: ({ holdId, promoCode, idempotencyKey }) => ({
        url: `/holds/${holdId}/checkout`,
        method: 'POST',
        body: promoCode ? { promoCode } : {},
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      invalidatesTags: (_result, _error, { eventId }) => [
        { type: 'Seats', id: eventId },
        'Holds',
        'Orders',
      ],
    }),

    myOrders: build.query<{ orders: Order[] }, void>({
      query: () => '/me/orders',
      providesTags: ['Orders'],
    }),

    /** Admin screen: POST /events (no login, as the brief says). */
    createEvent: build.mutation<EventDetails, CreateEventBody>({
      query: (body) => ({ url: '/events', method: 'POST', body }),
      invalidatesTags: ['Events'],
    }),
  }),
});

export const {
  useLogInMutation,
  useListEventsQuery,
  useGetEventQuery,
  useGetSeatsQuery,
  useMyHoldsQuery,
  useCreateHoldMutation,
  useReleaseHoldMutation,
  useCheckoutMutation,
  useMyOrdersQuery,
  useCreateEventMutation,
} = seatrushApi;

/** A unique key per attempt. crypto.randomUUID needs a secure context (localhost is). */
export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
