import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useListEventsQuery } from '../../api/seatrushApi';
import type { EventSummary } from '../../api/types';
import { friendlyError } from '../../lib/errors';
import { formatCountdown, useServerNow } from '../../lib/time';

/** Events list, each with a live countdown to its drop (by the server clock). */
export function EventsPage() {
  const { data, error, isLoading, refetch, fulfilledTimeStamp } = useListEventsQuery(undefined, {
    pollingInterval: 15_000,
  });
  const now = useServerNow(data?.serverNow, fulfilledTimeStamp);

  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {[0, 1, 2].map((i) => (
          <Grid key={i} size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rounded" height={170} />
          </Grid>
        ))}
      </Grid>
    );
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
  if (!data || data.events.length === 0) {
    return <Alert severity="info">No events yet. Check back soon!</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Upcoming shows</Typography>
      <Grid container spacing={2}>
        {data.events.map((event) => (
          <Grid key={event.id} size={{ xs: 12, md: 6, lg: 4 }}>
            <EventCard event={event} now={now} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

function EventCard({ event, now }: { event: EventSummary; now: number }) {
  const msToDrop = Date.parse(event.dropAt) - now;
  const open = msToDrop <= 0;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack spacing={1}>
          <Typography variant="h6">{event.name}</Typography>
          <Typography color="text.secondary">{event.venue}</Typography>
          <Typography variant="body2" color="text.secondary">
            Show: {new Date(event.startsAt).toLocaleString()}
          </Typography>
          {open ? (
            <Chip label="On sale now" color="success" sx={{ alignSelf: 'flex-start' }} />
          ) : (
            <Chip
              label={`Tickets drop in ${formatCountdown(msToDrop)}`}
              color="warning"
              sx={{ alignSelf: 'flex-start', fontVariantNumeric: 'tabular-nums' }}
            />
          )}
        </Stack>
      </CardContent>
      <CardActions>
        <Button component={RouterLink} to={`/events/${event.id}`} variant="contained">
          {open ? 'Choose seats' : 'View seats'}
        </Button>
      </CardActions>
    </Card>
  );
}
