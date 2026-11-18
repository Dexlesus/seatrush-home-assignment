import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  LinearProgress,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { lazy, Suspense } from 'react';
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAppSelector } from './app/hooks';

// Each page is loaded only when it's first opened (smaller first download).
const EventsPage = lazy(() =>
  import('./features/events/EventsPage').then((m) => ({ default: m.EventsPage })),
);
const EventPage = lazy(() =>
  import('./features/events/EventPage').then((m) => ({ default: m.EventPage })),
);
const LoginPage = lazy(() =>
  import('./features/session/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const TicketsPage = lazy(() =>
  import('./features/tickets/TicketsPage').then((m) => ({ default: m.TicketsPage })),
);

export function App() {
  const fan = useAppSelector((state) => state.session.current);
  const location = useLocation();
  const loginLink = `/login?next=${encodeURIComponent(location.pathname)}`;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/events"
            sx={{ color: 'inherit', textDecoration: 'none', mr: 2 }}
          >
            🎟️ SeatRush
          </Typography>
          <Button color="inherit" component={RouterLink} to="/events">
            Events
          </Button>
          <Button color="inherit" component={RouterLink} to="/tickets">
            My tickets
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {fan ? (
              <Chip
                label={fan.handle}
                sx={{ bgcolor: 'primary.dark', color: 'primary.contrastText' }}
              />
            ) : null}
            <Button
              variant="outlined"
              color="inherit"
              component={RouterLink}
              to={loginLink}
            >
              {fan ? 'Switch user' : 'Pick a username'}
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Suspense fallback={<LinearProgress />}>
          <Routes>
            <Route path="/" element={<Navigate to="/events" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:eventId" element={<EventPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="*" element={<Navigate to="/events" replace />} />
          </Routes>
        </Suspense>
      </Container>
    </Box>
  );
}
