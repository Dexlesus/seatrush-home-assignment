import { Alert, AlertTitle, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { Hold } from '../../../api/types';
import { formatAgorot } from '../../../lib/money';
import { formatCountdown, holdPhase, minutesMessage, type HoldPhase } from '../../../lib/time';

interface Props {
  hold: Hold;
  /** "Now" by the server clock. */
  now: number;
  busy: boolean;
  /** Extra credit: one promo code per order (SAVE10, WELCOME20). */
  onCheckout: (promoCode?: string) => void;
  onRelease: () => void;
  onHoldAgain: () => void;
}

const SEVERITY: Record<HoldPhase, 'info' | 'warning' | 'error'> = {
  calm: 'info',
  warning: 'warning', // orange from 1:00
  urgent: 'error', // red from 0:30
  expired: 'error',
};

/** The hold: a live countdown that changes colour, the seats, and checkout. */
export function HoldPanel({ hold, now, busy, onCheckout, onRelease, onHoldAgain }: Props) {
  const [promoCode, setPromoCode] = useState('');
  const msLeft = Date.parse(hold.expiresAt) - now;
  const totalMs = Date.parse(hold.expiresAt) - Date.parse(hold.createdAt);
  const phase = holdPhase(msLeft);
  const expired = phase === 'expired';

  return (
    <Stack spacing={2}>
      <Alert severity={SEVERITY[phase]} variant={phase === 'calm' ? 'standard' : 'filled'}>
        <AlertTitle>{expired ? 'Your hold ran out' : 'Your seats are held'}</AlertTitle>
        {expired ? (
          'The seats went back on sale. Try again: they might still be free.'
        ) : (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'baseline' }}>
            <Typography
              variant="h4"
              component="span"
              sx={{ fontVariantNumeric: 'tabular-nums' }}
              aria-live="off"
            >
              {formatCountdown(msLeft)}
            </Typography>
            {/* Changes once a minute, so screen readers hear it calmly. */}
            <Typography component="span" aria-live="polite">
              {minutesMessage(msLeft, totalMs)}
            </Typography>
          </Stack>
        )}
      </Alert>

      <Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 1 }}>
          {hold.seats.map((seat) => (
            <Chip
              key={seat.label}
              color={expired ? 'default' : 'success'}
              label={`${seat.label} · ${seat.zone} · ${formatAgorot(seat.priceAgorot)}`}
            />
          ))}
        </Stack>
        <Typography>
          Total <b>{formatAgorot(hold.totalAgorot)}</b>
        </Typography>
      </Box>

      {expired ? (
        <Button variant="contained" onClick={onHoldAgain} disabled={busy}>
          Try to hold them again
        </Button>
      ) : (
        <Stack direction="row" spacing={1}>
          <TextField
            label="Promo code"
            size="small"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="SAVE10"
            helperText="Optional"
            slotProps={{ htmlInput: { maxLength: 32 } }}
            sx={{ width: 130 }}
          />
          <Button
            variant="contained"
            size="large"
            onClick={() => onCheckout(promoCode.trim() || undefined)}
            disabled={busy}
            sx={{ flexGrow: 1, alignSelf: 'flex-start' }}
          >
            {busy ? 'Working…' : 'Checkout'}
          </Button>
          <Button onClick={onRelease} disabled={busy} sx={{ alignSelf: 'flex-start' }}>
            Release
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
