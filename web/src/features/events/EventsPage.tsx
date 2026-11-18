import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
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
import { CalendarIcon, ClockIcon, MapPinIcon, SparklesIcon, TicketIcon } from '../../components/icons';
import { friendlyError } from '../../lib/errors';
import { formatCountdown, useServerNow } from '../../lib/time';
import { TOKENS } from '../../theme';

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
            <Skeleton variant="rounded" height={210} sx={{ borderRadius: 6 }} />
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
      <Box>
        <Typography variant="h4" component="h1">
          Upcoming shows
        </Typography>
        <Typography color="text.secondary">
          Tickets go on sale at an exact time. Each fan can hold a few seats for a few minutes while paying.
        </Typography>
      </Box>
      <Grid container spacing={2.5}>
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
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, border-color 0.2s',
        '&:hover': { transform: 'translateY(-4px)', borderColor: alpha(TOKENS.cyan, 0.4) },
      }}
    >
      {/* The poster strip */}
      <Box
        sx={{
          height: 96,
          background: TOKENS.poster,
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <SparklesIcon sx={{ fontSize: 34, color: alpha(TOKENS.slate[100], 0.85) }} />
        <Box sx={{ position: 'absolute', top: 12, left: 12 }}>
          {open ? (
            <Chip
              size="small"
              label="On sale now"
              sx={{
                bgcolor: alpha(TOKENS.slate[950], 0.75),
                color: 'primary.main',
                border: 1,
                borderColor: alpha(TOKENS.emerald, 0.5),
                boxShadow: TOKENS.glow(TOKENS.emerald, 0.45),
              }}
            />
          ) : (
            <Chip
              size="small"
              icon={<ClockIcon sx={{ fontSize: 14 }} />}
              label={`Drops in ${formatCountdown(msToDrop)}`}
              sx={{
                bgcolor: alpha(TOKENS.slate[950], 0.75),
                color: 'warning.main',
                border: 1,
                borderColor: alpha(TOKENS.amber, 0.5),
                fontVariantNumeric: 'tabular-nums',
                '& .MuiChip-icon': { color: 'warning.main' },
              }}
            />
          )}
        </Box>
      </Box>

      <CardContent sx={{ flexGrow: 1 }}>
        <Stack spacing={1}>
          <Typography variant="h6">{event.name}</Typography>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary' }}>
            <MapPinIcon sx={{ fontSize: 15, color: 'secondary.main' }} />
            <Typography variant="body2">{event.venue}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary' }}>
            <CalendarIcon sx={{ fontSize: 15, color: 'primary.main' }} />
            <Typography variant="body2">Show: {new Date(event.startsAt).toLocaleString()}</Typography>
          </Stack>
        </Stack>
      </CardContent>
      <Box sx={{ p: 2, pt: 0 }}>
        <Button
          component={RouterLink}
          to={`/events/${event.id}`}
          variant={open ? 'contained' : 'outlined'}
          fullWidth
          startIcon={<TicketIcon />}
          sx={open ? undefined : { borderColor: 'divider', color: 'text.primary' }}
        >
          {open ? 'Choose seats' : 'View seats'}
        </Button>
      </Box>
    </Card>
  );
}
