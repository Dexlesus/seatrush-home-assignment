import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { baseApi } from '../../api/baseApi';
import { useLogInMutation } from '../../api/seatrushApi';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { TicketIcon } from '../../components/icons';
import { friendlyError } from '../../lib/errors';
import { TOKENS } from '../../theme';
import { signedIn } from './sessionSlice';

/**
 * No passwords. Typing a name creates a NEW fan with a unique handle
 * ("dana#4821"); typing a handle logs that fan back in. Recent handles are
 * one click away, to switch users easily.
 */
export function LoginPage() {
  const [name, setName] = useState('');
  const [logIn, { isLoading, error }] = useLogInMutation();
  const recent = useAppSelector((state) => state.session.recent);
  const current = useAppSelector((state) => state.session.current);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/events';

  async function enter(value: string) {
    const fan = await logIn(value.trim()).unwrap();
    // A new fan: forget every cached answer that belonged to the previous one.
    dispatch(baseApi.util.resetApiState());
    dispatch(signedIn(fan));
    navigate(next.startsWith('/login') ? '/events' : next);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() && !isLoading) {
      void enter(name).catch(() => undefined); // the error is shown below
    }
  }

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', mt: { md: 4 } }}>
      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2} component="form" onSubmit={onSubmit}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 3,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(TOKENS.emerald, 0.15),
                  border: 1,
                  borderColor: alpha(TOKENS.emerald, 0.3),
                  color: 'primary.main',
                }}
              >
                <TicketIcon />
              </Box>
              <Typography variant="h5" component="h1">
                Who's buying?
              </Typography>
            </Stack>
            <Typography color="text.secondary">
              No password needed. Type your name and you get a handle like{' '}
              <b>dana#4821</b>. Two people called Dana get two different handles.
              Type your handle later to come back as the same fan.
            </Typography>
            <TextField
              label="Your name, or your handle"
              placeholder="Dana  or  dana#4821"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              slotProps={{ htmlInput: { maxLength: 40 } }}
            />
            {error ? <Alert severity="error">{friendlyError(error)}</Alert> : null}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={!name.trim() || isLoading}
            >
              {isLoading ? 'One moment…' : 'Continue'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {recent.length > 0 ? (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Switch to a recent fan
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {recent.map((fan) => (
                <Chip
                  key={fan.handle}
                  label={fan.handle}
                  variant={fan.handle === current?.handle ? 'filled' : 'outlined'}
                  color={fan.handle === current?.handle ? 'primary' : 'default'}
                  onClick={() => void enter(fan.handle).catch(() => undefined)}
                  disabled={isLoading}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
