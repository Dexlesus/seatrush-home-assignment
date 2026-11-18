import { alpha, createTheme } from '@mui/material/styles';

/**
 * The one theme: a dark "cinema" look. Components use these tokens, never
 * their own colours.
 */
const SLATE = {
  950: '#020617',
  900: '#0f172a',
  800: '#1e293b',
  700: '#334155',
  600: '#475569',
  500: '#64748b',
  400: '#94a3b8',
  300: '#cbd5e1',
  100: '#f1f5f9',
} as const;

const EMERALD = '#10b981';
const TEAL = '#2dd4bf';
const CYAN = '#22d3ee';
const AMBER = '#f59e0b';
const ROSE = '#f43f5e';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: EMERALD, contrastText: SLATE[950] },
    secondary: { main: CYAN, contrastText: SLATE[950] },
    success: { main: EMERALD, contrastText: SLATE[950] },
    warning: { main: AMBER, contrastText: SLATE[950] },
    error: { main: ROSE },
    info: { main: '#38bdf8', contrastText: SLATE[950] },
    background: { default: '#070b14', paper: SLATE[900] },
    text: { primary: SLATE[100], secondary: SLATE[400], disabled: SLATE[600] },
    divider: alpha(SLATE[700], 0.6),
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Heebo", "Segoe UI", system-ui, sans-serif',
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    h5: { fontWeight: 800 },
    h6: { fontWeight: 700 },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          background: alpha(SLATE[900], 0.6),
          border: `1px solid ${alpha(SLATE[800], 0.9)}`,
          backdropFilter: 'blur(12px)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: alpha(SLATE[950], 0.7),
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(SLATE[800], 0.8)}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          variants: [
            {
              // The main call to action: a glowing emerald gradient.
              props: { variant: 'contained', color: 'primary' },
              style: {
                background: `linear-gradient(to left, ${EMERALD}, ${TEAL})`,
                boxShadow: `0 0 25px ${alpha(EMERALD, 0.4)}`,
                '&:hover': { boxShadow: `0 0 35px ${alpha(EMERALD, 0.65)}` },
                '&.Mui-disabled': { background: SLATE[800], boxShadow: 'none' },
              },
            },
          ],
        },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
          background: SLATE[900],
          border: `1px solid ${alpha(SLATE[700], 0.8)}`,
        },
      },
    },
  },
});

/** Named colours for the custom pieces (glows, seats, the stage). */
export const TOKENS = {
  slate: SLATE,
  emerald: EMERALD,
  cyan: CYAN,
  amber: AMBER,
  rose: ROSE,
  /** "Held for you" seats. */
  mine: '#38bdf8',
  /** The stage light. */
  sky: { 600: '#0284c7', 400: '#38bdf8', 100: '#e0f2fe' },
  indigo: { 500: '#6366f1', 400: '#818cf8', 300: '#a5b4fc' },
  /** The "poster" gradient (logo, event cards, tickets). */
  poster: `linear-gradient(135deg, ${CYAN}, #2563eb, #312e81)`,
  glow: (color: string, strength = 0.6) => `0 0 12px ${alpha(color, strength)}`,
} as const;

/**
 * Zone colours, the most expensive zone first: it gets the gold "VIP" look.
 * The others get cool colours, so zones are easy to tell apart.
 */
export const ZONE_TONES = [AMBER, CYAN, '#a78bfa', '#fb7185', '#a3e635'] as const;
