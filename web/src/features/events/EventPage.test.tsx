import { ThemeProvider } from '@mui/material';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { baseApi } from '../../api/baseApi';
import { theme } from '../../theme';
import { sessionReducer } from '../session/sessionSlice';
import { EventPage } from './EventPage';

/**
 * A screen test: the real event page, with a fake server (fetch) behind it.
 * The brief: "A double click never sends two holds."
 */
const EVENT_ID = 'e1';
const MINUTE = 60_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The fake API. Records every hold request it gets. */
function fakeServer() {
  const holdRequests: string[] = [];
  const now = new Date();
  const iso = (ms: number) => new Date(now.getTime() + ms).toISOString();

  async function handle(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === 'POST' && pathname === `/api/events/${EVENT_ID}/holds`) {
      holdRequests.push(request.headers.get('Idempotency-Key') ?? '');
      await new Promise((resolve) => setTimeout(resolve, 100)); // a busy server
      return json(
        {
          holdId: 'h1',
          eventId: EVENT_ID,
          status: 'ACTIVE',
          seats: [{ label: 'A2', zone: 'All', priceAgorot: 10000 }],
          totalAgorot: 10000,
          createdAt: iso(0),
          expiresAt: iso(5 * MINUTE),
          serverNow: iso(0),
        },
        201,
      );
    }
    switch (pathname) {
      case `/api/events/${EVENT_ID}`:
        return json({
          id: EVENT_ID,
          name: 'Test show',
          venue: 'Hall',
          startsAt: iso(7 * 24 * 60 * MINUTE),
          dropAt: iso(-MINUTE),
          saleOpen: true,
          serverNow: iso(0),
          rowCount: 1,
          seatsPerRow: 4,
          maxSeatsPerFan: 4,
          zones: [{ name: 'All', fromRow: 'A', toRow: 'A', priceAgorot: 10000 }],
        });
      case `/api/events/${EVENT_ID}/seats`:
        return json({
          eventId: EVENT_ID,
          serverNow: iso(0),
          seats: [1, 2, 3, 4].map((n) => ({
            label: `A${n}`,
            row: 'A',
            seatNumber: n,
            zone: 'All',
            priceAgorot: 10000,
            // A4 is held by someone else; the rest are free.
            status: n === 4 ? 'HELD' : 'AVAILABLE',
          })),
        });
      case '/api/me/holds':
        return json({ serverNow: iso(0), holds: [] });
      case '/api/me/orders':
        return json({ orders: [] });
      default:
        return json({ code: 'NOT_FOUND', message: pathname }, 404);
    }
  }

  return { holdRequests, handle };
}

function renderEventPage() {
  const store = configureStore({
    reducer: { session: sessionReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
    preloadedState: {
      session: { current: { handle: 'dana#1234', displayName: 'Dana' }, recent: [] },
    },
  });
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[`/events/${EVENT_ID}`]}>
          <Routes>
            <Route path="/events/:eventId" element={<EventPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>,
  );
}

describe('EventPage (screen test with a fake server)', () => {
  let server: ReturnType<typeof fakeServer>;

  beforeEach(() => {
    server = fakeServer();
    const RealRequest = globalThis.Request;
    // The app calls "/api/..." (relative, like in a browser); Node needs a full
    // URL. jsdom's AbortSignal is not Node's, so it is left out in tests.
    vi.stubGlobal(
      'Request',
      class extends RealRequest {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          const url = typeof input === 'string' ? new URL(input, 'http://localhost') : input;
          super(url, { ...init, signal: undefined });
        }
      },
    );
    vi.stubGlobal('fetch', (request: Request) => server.handle(request));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a double click on "Hold" sends ONE hold request, and the hold appears', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderEventPage();

    await user.click(await screen.findByRole('button', { name: /Seat A2, available/ }));
    await user.dblClick(screen.getByRole('button', { name: 'Hold 1 seat' }));

    expect(await screen.findByText('Your seats are held')).toBeInTheDocument();
    expect(server.holdRequests).toHaveLength(1);
  });

  it('pointing at a seat someone else holds says so, and clicking it selects nothing', async () => {
    const user = userEvent.setup();
    renderEventPage();

    const heldSeat = await screen.findByRole('button', { name: 'Seat A4, held by someone' });
    await user.hover(heldSeat);
    expect(await screen.findByText(/Held by another fan/)).toBeInTheDocument();

    await user.click(heldSeat);
    expect(screen.getByText('Your selection (0)')).toBeInTheDocument();
  });
});
