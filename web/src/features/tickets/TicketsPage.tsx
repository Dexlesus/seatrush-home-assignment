import { Alert, Box, Button, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useMyOrdersQuery } from '../../api/seatrushApi';
import { useAppSelector } from '../../app/hooks';
import { TicketStub } from '../../components/TicketStub';
import { friendlyError } from '../../lib/errors';

/** My tickets: every order of the current fan, newest first, as e-tickets. */
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
    return <Skeleton variant="rounded" height={220} sx={{ borderRadius: 6 }} />;
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

  const seats = data.orders.reduce((sum, o) => sum + o.seats.length, 0);
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          My tickets
        </Typography>
        <Typography color="text.secondary">
          {data.orders.length} order{data.orders.length === 1 ? '' : 's'} · {seats} seat
          {seats === 1 ? '' : 's'}, newest first.
        </Typography>
      </Box>
      <Grid container spacing={2.5}>
        {data.orders.map((order) => (
          <Grid key={order.orderId} size={{ xs: 12, md: 6 }}>
            <TicketStub order={order} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
