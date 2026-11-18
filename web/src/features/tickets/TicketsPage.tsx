import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useMyOrdersQuery } from '../../api/seatrushApi';
import { useAppSelector } from '../../app/hooks';
import { friendlyError } from '../../lib/errors';
import { formatAgorot } from '../../lib/money';

/** My tickets: every order of the current fan, newest first. */
export function TicketsPage() {
  const fan = useAppSelector((state) => state.session.current);
  const { data, error, isLoading, refetch } = useMyOrdersQuery(undefined, {
    skip: !fan,
  });

  if (!fan) {
    return (
      <Alert
        severity="info"
        action={
          <Button color="inherit" component={RouterLink} to="/login?next=/tickets">
            Pick a username
          </Button>
        }
      >
        Pick a username to see your tickets.
      </Alert>
    );
  }
  if (isLoading) {
    return <Skeleton variant="rounded" height={160} />;
  }
  if (error) {
    return (
      <Alert
        severity="error"
        action={<Button color="inherit" onClick={() => void refetch()}>Retry</Button>}
      >
        {friendlyError(error)}
      </Alert>
    );
  }
  if (!data || data.orders.length === 0) {
    return (
      <Alert
        severity="info"
        action={
          <Button color="inherit" component={RouterLink} to="/events">
            Find a show
          </Button>
        }
      >
        No tickets yet, {fan.displayName}.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">My tickets</Typography>
      {data.orders.map((order) => (
        <Card key={order.orderId}>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">{order.eventName}</Typography>
              <Typography color="text.secondary">
                {order.venue} · {new Date(order.startsAt).toLocaleString()}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {order.seats.map((seat) => (
                  <Chip
                    key={seat.label}
                    label={`${seat.label} · ${seat.zone} · ${formatAgorot(seat.priceAgorot)}`}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Stack>
              <Typography>
                Total <b>{formatAgorot(order.totalAgorot)}</b> · Order{' '}
                <code>{order.orderId.slice(0, 8)}</code> · Bought{' '}
                {new Date(order.createdAt).toLocaleString()}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
