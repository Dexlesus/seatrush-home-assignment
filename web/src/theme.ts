import { createTheme } from '@mui/material/styles';

/** The one theme. Components use its tokens, never their own colours. */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#5b3cc4' },
    secondary: { main: '#e0457b' },
    success: { main: '#2e9d5b' },
    warning: { main: '#ef8a17' },
    error: { main: '#d93a3a' },
    info: { main: '#1f86c7' },
    background: { default: '#f6f5fb', paper: '#ffffff' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
});

/** Zone colours, by zone order: picked from the theme palette. */
export const ZONE_PALETTE = ['secondary', 'info', 'success', 'warning', 'primary'] as const;
