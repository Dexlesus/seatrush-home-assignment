import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useState, type ReactNode } from 'react';
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
import type { EventDetails, Hold, HoldBody, Order } from '../../api/types';
import { useAppSelector } from '../../app/hooks';
import {
  ArmchairIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  SparklesIcon,
  XIcon,
} from '../../components/icons';
import { TicketStub } from '../../components/TicketStub';
import { errorCode, friendlyError, joinSeats } from '../../lib/errors';
import { formatAgorot } from '../../lib/money';
import { seatsLeftToPick } from '../../lib/seats';
import { formatCountdown, useServerNow } from '../../lib/time';
import { useSlow } from '../../lib/useSlow';
import { TOKENS } from '../../theme';
import { AvailabilityCard } from './components/AvailabilityCard';
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
  const now = useServerNow(
    seatsQuery.data?.serverNow ?? eventQuery.data?.serverNow,
    seatsQuery.data ? seatsQuery.fulfilledTimeStamp : eventQuery.fulfilledTimeStamp,
  );

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
    return <Skeleton variant="rounded" height={420} sx={{ borderRadius: 6 }} />;
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
  const pickedSeats = seatMap.seats.filter((s) => picked.includes(s.label));
  const pickedTotal = pickedSeats.reduce((sum, s) => sum + s.priceAgorot, 0);

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

  /** The side panel's main card, by where the fan is in the flow. */
  function actions(): ReactNode {
    if (!fan) {
      return (
        <Stack spacing={1.5}>
          <Typography color="text.secondary">Pick a username to hold seats. No password needed.</Typography>
          <Button variant="contained" size="large" component={RouterLink} to={loginLink}>
            Pick a username to hold seats
          </Button>
        </Stack>
      );
    }
    if (hold) {
      return (
        <HoldPanel
          hold={hold}
          now={now}
          busy={busy}
          onCheckout={(promoCode) => void doCheckout(promoCode)}
          onRelease={() => void doRelease()}
          onHoldAgain={() => void doHold({ seats: hold.seats.map((s) => s.label) })}
        />
      );
    }
    if (atLimit) {
      return (
        <Stack spacing={1.5}>
          <Typography sx={{ color: 'primary.main', fontWeight: 700 }}>
            You have {bought + held} seats for this show, the most one fan can have. 🎟️
          </Typography>
          <Button variant="contained" component={RouterLink} to="/tickets">
            My tickets
          </Button>
        </Stack>
      );
    }
    return (
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ArmchairIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, flexGrow: 1 }}>
            Your selection ({picked.length})
          </Typography>
          {picked.length > 0 ? (
            <Button size="small" color="inherit" onClick={() => setSelected([])} sx={{ color: 'text.secondary' }}>
              Clear
            </Button>
          ) : null}
        </Stack>
        {picked.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Click up to {canPick} seat{canPick === 1 ? '' : 's'} on the map.
            {bought + held > 0 ? ` You already have ${bought + held} for this show.` : ''}
          </Typography>
        ) : (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {pickedSeats.map((seat) => (
              <Chip
                key={seat.label}
                label={`Row ${seat.row} · Seat ${seat.seatNumber} · ${formatAgorot(seat.priceAgorot)}`}
                onDelete={() => toggle(seat.label)}
                deleteIcon={<XIcon aria-label={`Remove ${seat.label}`} />}
                sx={{
                  bgcolor: alpha(TOKENS.emerald, 0.15),
                  border: 1,
                  borderColor: alpha(TOKENS.emerald, 0.4),
                  color: 'primary.main',
                }}
              />
            ))}
          </Stack>
        )}
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography color="text.secondary">{saleOpen ? 'Total' : 'Tickets drop in'}</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
            {saleOpen ? formatAgorot(pickedTotal) : formatCountdown(msToDrop)}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!saleOpen || busy || picked.length === 0}
          onClick={() => void doHold({ seats: picked })}
          sx={{ py: 1.5 }}
        >
          Hold {picked.length || ''} seat{picked.length === 1 ? '' : 's'}
        </Button>
        {saleOpen ? (
          <>
            <Divider sx={{ color: 'text.disabled', fontSize: 12 }}>or</Divider>
            <BestAvailablePanel
              seats={seatMap.seats}
              zones={event.zones}
              maxCount={canPick}
              disabled={busy}
              onFind={(body) => void doHold(body)}
            />
          </>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <EventHeader event={event} saleOpen={saleOpen} msToDrop={msToDrop} />

      <Grid container spacing={3} sx={{ alignItems: 'flex-start' }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ px: { xs: 1, sm: 3 }, py: 3 }}>
              <SeatMap seats={seatMap.seats} zones={event.zones} selected={picked} mine={mine} onToggle={toggle} />
            </CardContent>
          </Card>
        </Grid>

        {/* The side panel: stays in view while the fan scrolls the map. */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
          <Stack spacing={2}>
            {busy ? <LinearProgress sx={{ borderRadius: 1 }} /> : null}
            {slow ? (
              <Alert severity="info">
                Still working: the server is busy. Don't refresh. You won't be booked twice.
              </Alert>
            ) : null}
            {!saleOpen ? (
              <Alert severity="warning" icon={<ClockIcon />}>
                Tickets drop in{' '}
                <b style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCountdown(msToDrop)}</b>. Stay
                here: the buttons unlock by themselves.
              </Alert>
            ) : null}
            {lost.length > 0 && !hold ? (
              <Alert severity="warning" onClose={() => setSelected(picked)}>
                Someone just took {joinSeats(lost)}, so it's no longer in your selection.
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

            <Card>
              <CardContent sx={{ p: 2.5 }}>{actions()}</CardContent>
            </Card>

            <AvailabilityCard seats={seatMap.seats} zones={event.zones} />
          </Stack>
        </Grid>
      </Grid>

      <OrderDialog order={order} onClose={() => setOrder(null)} />
    </Stack>
  );
}

/** The top of the page: a poster tile and the show's details. */
function EventHeader({
  event,
  saleOpen,
  msToDrop,
}: {
  event: EventDetails;
  saleOpen: boolean;
  msToDrop: number;
}) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 56,
              height: 78,
              flexShrink: 0,
              borderRadius: 3,
              p: '1px',
              background: TOKENS.poster,
              boxShadow: TOKENS.glow(TOKENS.cyan, 0.25),
            }}
          >
            <Box sx={{ width: '100%', height: '100%', borderRadius: 2.75, bgcolor: alpha(TOKENS.slate[950], 0.8), display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <Box>
                <SparklesIcon sx={{ fontSize: 20, color: 'secondary.main' }} />
                <Typography sx={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', color: 'secondary.light' }}>
                  LIVE
                </Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" sx={{ mb: 0.5, flexWrap: 'wrap', gap: 1 }}>
              {saleOpen ? (
                <Chip
                  size="small"
                  label="On sale now"
                  sx={{
                    bgcolor: alpha(TOKENS.emerald, 0.15),
                    color: 'primary.main',
                    border: 1,
                    borderColor: alpha(TOKENS.emerald, 0.35),
                    boxShadow: TOKENS.glow(TOKENS.emerald, 0.3),
                  }}
                />
              ) : (
                <Chip
                  size="small"
                  label={`Drops in ${formatCountdown(msToDrop)}`}
                  sx={{
                    bgcolor: alpha(TOKENS.amber, 0.15),
                    color: 'warning.main',
                    border: 1,
                    borderColor: alpha(TOKENS.amber, 0.3),
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
              )}
              <Chip size="small" label={`${event.rowCount} rows × ${event.seatsPerRow} seats`} sx={{ bgcolor: TOKENS.slate[800] }} />
              <Chip size="small" label={`Up to ${event.maxSeatsPerFan} seats per fan`} sx={{ bgcolor: TOKENS.slate[800] }} />
            </Stack>
            <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 22, sm: 28 } }}>
              {event.name}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, mt: 0.5, color: 'text.secondary' }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                <MapPinIcon sx={{ fontSize: 15, color: 'secondary.main' }} />
                <Typography variant="body2">{event.venue}</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                <CalendarIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                <Typography variant="body2">{new Date(event.startsAt).toLocaleString()}</Typography>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** After checkout: a big "you're going", and the ticket. */
function OrderDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  return (
    <Dialog open={order !== null} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="order-title">
      {order ? (
        <DialogContent sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center', position: 'relative' }}>
          <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', top: 12, right: 12 }}>
            <XIcon />
          </IconButton>
          <Box
            sx={{
              width: 56,
              height: 56,
              mx: 'auto',
              mb: 2,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(TOKENS.emerald, 0.2),
              border: 1,
              borderColor: alpha(TOKENS.emerald, 0.4),
              color: 'primary.main',
            }}
          >
            <CheckIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography id="order-title" variant="h5" sx={{ fontWeight: 900 }}>
            You're going! 🎉
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {joinSeats(order.seats.map((s) => s.label))} · {formatAgorot(order.totalAgorot)}
            {order.promoCode ? ` (${order.promoCode} saved you ${formatAgorot(order.discountAgorot)})` : ''}
          </Typography>
          <Box sx={{ textAlign: 'left', mb: 3 }}>
            <TicketStub order={order} />
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="contained" size="large" fullWidth component={RouterLink} to="/tickets">
              My tickets
            </Button>
            <Button size="large" fullWidth onClick={onClose} sx={{ bgcolor: TOKENS.slate[800], color: 'text.primary' }}>
              Back to the seat map
            </Button>
          </Stack>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
