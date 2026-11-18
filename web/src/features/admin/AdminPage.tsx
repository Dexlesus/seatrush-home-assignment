import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useCreateEventMutation } from '../../api/seatrushApi';
import { friendlyError } from '../../lib/errors';
import {
  defaultDraft,
  rowLetter,
  toCreateEventBody,
  toDateTimeLocal,
  type EventDraft,
  type ZoneDraft,
} from '../../lib/eventForm';

/**
 * Extra credit: an admin screen to create events. It calls the same
 * POST /api/events as everyone else (no login, as the brief says).
 */
export function AdminPage() {
  const [draft, setDraft] = useState<EventDraft>(() => defaultDraft(new Date()));
  const [errors, setErrors] = useState<string[]>([]);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const [createEvent, { isLoading, error }] = useCreateEventMutation();

  function set<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setZone(index: number, patch: Partial<ZoneDraft>) {
    set(
      'zones',
      draft.zones.map((zone, i) => (i === index ? { ...zone, ...patch } : zone)),
    );
  }

  function dropIn(minutes: number) {
    set('dropAt', toDateTimeLocal(new Date(Date.now() + minutes * 60_000)));
  }

  async function submit() {
    setCreated(null);
    const result = toCreateEventBody(draft);
    setErrors(result.errors);
    if (!result.body) return;
    try {
      const event = await createEvent(result.body).unwrap();
      setCreated({ id: event.id, name: event.name });
      setDraft(defaultDraft(new Date()));
    } catch {
      // Shown below from `error` (the server's readable message).
    }
  }

  const rows = Number(draft.rowCount);
  const lastRow = Number.isInteger(rows) && rows >= 1 && rows <= 100 ? rowLetter(rows - 1) : '?';

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Create an event</Typography>
        <Typography color="text.secondary">
          Admin screen. Rows go from A (nearest the stage) to {lastRow}; every row must be in
          exactly one price zone.
        </Typography>
      </Box>

      {created ? (
        <Alert
          severity="success"
          action={
            <Button color="inherit" component={RouterLink} to={`/events/${created.id}`}>
              Open it
            </Button>
          }
        >
          "{created.name}" is created.
        </Alert>
      ) : null}
      {errors.length > 0 ? (
        <Alert severity="warning">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </Alert>
      ) : null}
      {error ? <Alert severity="error">{friendlyError(error)}</Alert> : null}

      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Name"
                fullWidth
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Venue"
                fullWidth
                value={draft.venue}
                onChange={(e) => set('venue', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Tickets go on sale (drop)"
                type="datetime-local"
                fullWidth
                value={draft.dropAt}
                onChange={(e) => set('dropAt', e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" onClick={() => dropIn(0)}>
                  Now
                </Button>
                <Button size="small" onClick={() => dropIn(1)}>
                  In 1 min
                </Button>
                <Button size="small" onClick={() => dropIn(5)}>
                  In 5 min
                </Button>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Show starts"
                type="datetime-local"
                fullWidth
                value={draft.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Rows"
                type="number"
                fullWidth
                value={draft.rowCount}
                onChange={(e) => set('rowCount', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Seats per row"
                type="number"
                fullWidth
                value={draft.seatsPerRow}
                onChange={(e) => set('seatsPerRow', e.target.value)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Price zones</Typography>
            {draft.zones.map((zone, index) => (
              <Stack key={zone.key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TextField
                  label="Zone name"
                  size="small"
                  value={zone.name}
                  onChange={(e) => setZone(index, { name: e.target.value })}
                />
                <TextField
                  label="From row"
                  size="small"
                  value={zone.fromRow}
                  onChange={(e) => setZone(index, { fromRow: e.target.value })}
                  sx={{ width: 90 }}
                />
                <TextField
                  label="To row"
                  size="small"
                  value={zone.toRow}
                  onChange={(e) => setZone(index, { toRow: e.target.value })}
                  sx={{ width: 90 }}
                />
                <TextField
                  label="Price (₪)"
                  size="small"
                  value={zone.price}
                  onChange={(e) => setZone(index, { price: e.target.value })}
                  sx={{ width: 110 }}
                />
                <IconButton
                  aria-label={`Remove zone ${zone.name}`}
                  onClick={() =>
                    set(
                      'zones',
                      draft.zones.filter((_, i) => i !== index),
                    )
                  }
                >
                  ✕
                </IconButton>
              </Stack>
            ))}
            <Button
              sx={{ alignSelf: 'flex-start' }}
              onClick={() =>
                set('zones', [
                  ...draft.zones,
                  { key: Date.now(), name: '', fromRow: '', toRow: '', price: '' },
                ])
              }
            >
              + Add a zone
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Button
        variant="contained"
        size="large"
        disabled={isLoading}
        onClick={() => void submit()}
        sx={{ alignSelf: 'flex-start' }}
      >
        {isLoading ? 'Creating…' : 'Create event'}
      </Button>
    </Stack>
  );
}
