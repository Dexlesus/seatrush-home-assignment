import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  newIdempotencyKey,
  useCheckoutMutation,
  useCreateHoldMutation,
  useGetEventQuery,
  useGetSeatsQuery,
  useMyHoldsQuery,
  useMyOrdersQuery,
  useReleaseHoldMutation,
} from '../../api/seatrushApi';
import type { Hold, HoldBody, Order } from '../../api/types';
import { useAppSelector } from '../../app/hooks';
import { errorCode, friendlyError, joinSeats } from '../../lib/errors';
import { formatAgorot } from '../../lib/money';
import { seatsLeftToPick } from '../../lib/seats';
import { formatCountdown, useServerNow } from '../../lib/time';
import { useSlow } from '../../lib/useSlow';
import { BestAvailablePanel } from './components/BestAvailablePanel';
import { HoldPanel } from './components/HoldPanel';
import { SeatMap } from './components/SeatMap';

interface Notice {
  severity: 'error' | 'info' | 'success' | 'warning';
  text: string;
  /** For network errors: try again with the SAME Idempotency-Key. */
  retry?: () => void;
}

/** The event page: seat map, select or "best available", hold, checkout. */
export function EventPage() {
  const { eventId = '' } = useParams();
  const fan = useAppSelector((state) => state.session.current);

  const eventQuery = useGetEventQuery(eventId);
  // Seats stay up to date: polling every 2 seconds (paused when the tab is hidden).
  const seatsQuery = useGetSeatsQuery(eventId, {
    pollingInterval: 2000,
    skipPollingIfUnfocused: true,
  });
  const holdsQuery = useMyHoldsQuery(undefined, { skip: !fan });
  // Seats this fan already bought, for the per-fan limit (rule 4).
  const ordersQuery = useMyOrdersQuery(undefined, { skip: !fan });
  const now = useServerNow(seatsQuery.data?.serverNow ?? eventQuery.data?.serverNow);

  const [createHold, holdState] = useCreateHoldMutation();
  const [releaseHold, releaseState] = useReleaseHoldMutation();
  const [checkout, checkoutState] = useCheckoutMutation();

  const [selected, setSelected] = useState<string[]>([]);
  const [madeHere, setMadeHere] = useState<Hold | null>(null);
  /** Holds this page is done with (released / bought), so a stale list can't bring them back. */
  const [closedHoldIds, setClosedHoldIds] = useState<string[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const busy = holdState.isLoading || checkoutState.isLoading || releaseState.isLoading;
  const slow = useSlow(busy);

  // The hold to show: the one made on this page, or an active one from the
  // server (to resume after a reload, or from another tab of this fan).
  const fromServer = holdsQuery.data?.holds.find(
    (h) => h.eventId === eventId && !closedHoldIds.includes(h.holdId),
  );
  const hold =
    madeHere && !closedHoldIds.includes(madeHere.holdId) ? madeHere : (fromServer ?? null);

  function closeHold(holdId: string) {
    setClosedHoldIds((ids) => [...ids, holdId]);
    setMadeHere(null);
  }

  if (eventQuery.isLoading || seatsQuery.isLoading) {
    return <Skeleton variant="rounded" height={420} />;
  }
  if (eventQuery.error || !eventQuery.data || !seatsQuery.data) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" onClick={() => void eventQuery.refetch()}>
            Retry
          </Button>
        }
      >
        {friendlyError(eventQuery.error ?? seatsQuery.error) || 'Could not load this event.'}
      </Alert>
    );
  }

  const event = eventQuery.data;
  const seatMap = seatsQuery.data;
  const msToDrop = Date.parse(event.dropAt) - now;
  const saleOpen = msToDrop <= 0;
  const holdActive = hold !== null && Date.parse(hold.expiresAt) > now;
  const mine = holdActive ? hold.seats.map((s) => s.label) : [];
  const loginLink = `/login?next=/events/${eventId}`;

  // Seats stay up to date (polling): a selected seat someone else just took
  // drops out of the selection, and we say so.
  const free = new Set(
    seatMap.seats.filter((s) => s.status === 'AVAILABLE').map((s) => s.label),
  );
  const picked = selected.filter((label) => free.has(label));
  const lost = selected.filter((label) => !free.has(label));
  const pickedTotal = seatMap.seats
    .filter((s) => picked.includes(s.label))
    .reduce((sum, s) => sum + s.priceAgorot, 0);

  // Rule 4 on screen: what the fan already has for this event (bought + held
  // and not expired) decides how many more seats they may pick.
  const bought = (ordersQuery.data?.orders ?? [])
    .filter((o) => o.eventId === eventId)
    .reduce((sum, o) => sum + o.seats.length, 0);
  const held = (holdsQuery.data?.holds ?? [])
    .filter(
      (h) =>
        h.eventId === eventId &&
        !closedHoldIds.includes(h.holdId) &&
        Date.parse(h.expiresAt) > now,
    )
    .reduce((sum, h) => sum + h.seats.length, 0);
  const { remaining, canPick } = seatsLeftToPick({
    limit: event.maxSeatsPerFan,
    bought,
    held,
  });
  const atLimit = fan !== null && remaining === 0;

  function toggle(label: string) {
    setNotice(null);
    if (picked.includes(label)) {
      setSelected(picked.filter((l) => l !== label));
    } else if (atLimit) {
      setNotice({
        severity: 'info',
        text: `You already have ${bought + held} seats for this show, the most one fan can have.`,
      });
    } else if (picked.length >= canPick) {
      setNotice({
        severity: 'info',
        text:
          canPick < 4
            ? `You can add ${canPick} more seat${canPick === 1 ? '' : 's'} for this show (you have ${bought + held}).`
            : 'You can pick up to 4 seats at a time.',
      });
    } else {
      setSelected([...picked, label]);
    }
  }

  /** One Idempotency-Key per attempt: a double click or a retry never makes two holds. */
  async function doHold(body: HoldBody, idempotencyKey = newIdempotencyKey()) {
    setNotice(null);
    setOrder(null);
    try {
      const result = await createHold({ eventId, body, idempotencyKey }).unwrap();
      setMadeHere(result);
      setSelected([]);
    } catch (error) {
      const code = errorCode(error);
      const retriable = code === null || code === 'BUSY_TRY_AGAIN';
      setNotice({
        severity: 'error',
        text: friendlyError(error),
        retry: retriable ? () => void doHold(body, idempotencyKey) : undefined,
      });
      if (code === 'SEAT_TAKEN') void seatsQuery.refetch();
    }
  }

  async function doCheckout(promoCode?: string, idempotencyKey = newIdempotencyKey()) {
    if (!hold) return;
    setNotice(null);
    try {
      const result = await checkout({
        holdId: hold.holdId,
        eventId,
        promoCode,
        idempotencyKey,
      }).unwrap();
      setOrder(result);
      closeHold(hold.holdId);
    } catch (error) {
      const code = errorCode(error);
      setNotice({
        severity: 'error',
        text: friendlyError(error),
        retry:
          code === null || code === 'BUSY_TRY_AGAIN'
            ? () => void doCheckout(promoCode, idempotencyKey)
            : undefined,
      });
    }
  }

  async function doRelease() {
    if (!hold) return;
    try {
      await releaseHold({ holdId: hold.holdId, eventId }).unwrap();
      closeHold(hold.holdId);
      setNotice({ severity: 'info', text: 'Your seats are released.' });
    } catch (error) {
      setNotice({ severity: 'error', text: friendlyError(error) });
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">{event.name}</Typography>
        <Typography color="text.secondary">
          {event.venue} · {new Date(event.startsAt).toLocaleString()}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <SeatMap
                seats={seatMap.seats}
                zones={event.zones}
                selected={picked}
                mine={mine}
                onToggle={toggle}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                {!saleOpen ? (
                  <Alert severity="warning">
                    Tickets drop in{' '}
                    <b style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCountdown(msToDrop)}
                    </b>
                    . Stay here: the buttons unlock by themselves.
                  </Alert>
                ) : (
                  <Chip label="On sale now" color="success" sx={{ alignSelf: 'flex-start' }} />
                )}

                {busy ? <LinearProgress /> : null}
                {slow ? (
                  <Alert severity="info">
                    Still working: the server is busy. Don't refresh. You won't be booked twice.
                  </Alert>
                ) : null}

                {lost.length > 0 && !hold ? (
                  <Alert severity="warning" onClose={() => setSelected(picked)}>
                    Someone just took {joinSeats(lost)}, so it's no longer in your
                    selection.
                  </Alert>
                ) : null}

                {notice ? (
                  <Alert
                    severity={notice.severity}
                    onClose={() => setNotice(null)}
                    action={
                      notice.retry ? (
                        <Button color="inherit" onClick={notice.retry}>
                          Try again
                        </Button>
                      ) : undefined
                    }
                  >
                    {notice.text}
                  </Alert>
                ) : null}

                {order ? (
                  <Alert
                    severity="success"
                    action={
                      <Button color="inherit" component={RouterLink} to="/tickets">
                        My tickets
                      </Button>
                    }
                  >
                    You're going! 🎉 {joinSeats(order.seats.map((s) => s.label))} ·{' '}
                    {formatAgorot(order.totalAgorot)}
                    {order.promoCode
                      ? ` (${order.promoCode} saved you ${formatAgorot(order.discountAgorot)})`
                      : ''}
                  </Alert>
                ) : null}

                {!fan ? (
                  <Button variant="contained" component={RouterLink} to={loginLink}>
                    Pick a username to hold seats
                  </Button>
                ) : hold ? (
                  <HoldPanel
                    hold={hold}
                    now={now}
                    busy={busy}
                    onCheckout={(promoCode) => void doCheckout(promoCode)}
                    onRelease={() => void doRelease()}
                    onHoldAgain={() => void doHold({ seats: hold.seats.map((s) => s.label) })}
                  />
                ) : atLimit ? (
                  <Alert
                    severity="success"
                    action={
                      <Button color="inherit" component={RouterLink} to="/tickets">
                        My tickets
                      </Button>
                    }
                  >
                    You have {bought + held} seats for this show, the most one fan can have. 🎟️
                  </Alert>
                ) : (
                  <>
                    <Typography variant="subtitle1">Your selection</Typography>
                    {picked.length === 0 ? (
                      <Typography color="text.secondary">
                        Click up to {canPick} seat{canPick === 1 ? '' : 's'} on the map.
                        {bought + held > 0
                          ? ` You already have ${bought + held} for this show.`
                          : ''}
                      </Typography>
                    ) : (
                      <Typography>
                        {joinSeats(picked)} · <b>{formatAgorot(pickedTotal)}</b>
                      </Typography>
                    )}
                    <Button
                      variant="contained"
                      size="large"
                      disabled={!saleOpen || busy || picked.length === 0}
                      onClick={() => void doHold({ seats: picked })}
                    >
                      Hold {picked.length || ''} seat{picked.length === 1 ? '' : 's'}
                    </Button>
                    <Divider>or</Divider>
                    <BestAvailablePanel
                      seats={seatMap.seats}
                      zones={event.zones}
                      maxCount={canPick}
                      disabled={!saleOpen || busy}
                      onFind={(body) => void doHold(body)}
                    />
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
