import { alpha, AppBar, Box, Button, Chip, Container, LinearProgress, Stack, Toolbar, Typography } from '@mui/material';
import { lazy, Suspense } from 'react';
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAppSelector } from './app/hooks';
import { SparklesIcon } from './components/icons';
import { TOKENS } from './theme';

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
const AdminPage = lazy(() =>
  import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })),
);
const TicketsPage = lazy(() =>
  import('./features/tickets/TicketsPage').then((m) => ({ default: m.TicketsPage })),
);

const NAV = [
  { to: '/events', label: 'Events' },
  { to: '/tickets', label: 'My tickets' },
  { to: '/admin', label: 'Admin' },
];

/** Soft coloured light behind every page (decoration only). */
function Glow() {
  const blob = (color: string, size: number) => ({
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: '50%',
    filter: 'blur(140px)',
    bgcolor: alpha(color, 0.08),
  });
  return (
    <Box aria-hidden sx={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      <Box sx={{ ...blob(TOKENS.cyan, 900), height: 420, top: -160, left: '50%', transform: 'translateX(-50%)' }} />
      <Box sx={{ ...blob(TOKENS.amber, 450), top: '33%', right: '-10%' }} />
      <Box sx={{ ...blob(TOKENS.emerald, 500), bottom: 0, left: '-10%' }} />
    </Box>
  );
}

export function App() {
  const fan = useAppSelector((state) => state.session.current);
  const location = useLocation();
  const loginLink = `/login?next=${encodeURIComponent(location.pathname)}`;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', position: 'relative' }}>
      <Glow />
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Stack
            direction="row"
            spacing={1.5}
            component={RouterLink}
            to="/events"
            sx={{ alignItems: 'center', color: 'inherit', textDecoration: 'none', mr: 2 }}
          >
            {/* The logo tile, with the same gradient as an event poster. */}
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 2.5,
                display: 'grid',
                placeItems: 'center',
                background: TOKENS.poster,
                boxShadow: TOKENS.glow(TOKENS.cyan, 0.35),
              }}
            >
              <SparklesIcon sx={{ fontSize: 18, color: 'common.white' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
              SeatRush
            </Typography>
          </Stack>

          {NAV.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Button
                key={item.to}
                component={RouterLink}
                to={item.to}
                sx={{
                  color: active ? 'text.primary' : 'text.secondary',
                  bgcolor: active ? alpha(TOKENS.slate[100], 0.08) : 'transparent',
                  px: 2,
                  borderRadius: 99,
                }}
              >
                {item.label}
              </Button>
            );
          })}

          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {fan ? (
              <Chip
                label={fan.handle}
                sx={{
                  bgcolor: alpha(TOKENS.emerald, 0.15),
                  color: 'primary.main',
                  border: 1,
                  borderColor: alpha(TOKENS.emerald, 0.4),
                }}
              />
            ) : null}
            <Button
              variant="outlined"
              color="inherit"
              component={RouterLink}
              to={loginLink}
              sx={{ borderColor: 'divider', borderRadius: 99 }}
            >
              {fan ? 'Switch user' : 'Pick a username'}
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4, position: 'relative', zIndex: 1 }}>
        <Suspense fallback={<LinearProgress />}>
          <Routes>
            <Route path="/" element={<Navigate to="/events" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:eventId" element={<EventPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/events" replace />} />
          </Routes>
        </Suspense>
      </Container>
    </Box>
  );
}
