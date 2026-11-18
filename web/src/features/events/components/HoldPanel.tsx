import { alpha, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { Hold } from '../../../api/types';
import { ClockIcon } from '../../../components/icons';
import { formatAgorot } from '../../../lib/money';
import { formatCountdown, holdPhase, minutesMessage, type HoldPhase } from '../../../lib/time';
import { TOKENS } from '../../../theme';

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

/** calm → orange at 1:00 → red at 0:30. */
const PHASE_COLOR: Record<HoldPhase, string> = {
  calm: TOKENS.cyan,
  warning: TOKENS.amber,
  urgent: TOKENS.rose,
  expired: TOKENS.rose,
};

/** The hold, in the bottom bar: a live countdown that changes colour, the seats, and checkout. */
export function HoldPanel({ hold, now, busy, onCheckout, onRelease, onHoldAgain }: Props) {
  const [promoCode, setPromoCode] = useState('');
  const msLeft = Date.parse(hold.expiresAt) - now;
  const totalMs = Date.parse(hold.expiresAt) - Date.parse(hold.createdAt);
  const phase = holdPhase(msLeft);
  const expired = phase === 'expired';
  const color = PHASE_COLOR[phase];

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between', width: '100%' }}
    >
      {/* The countdown */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: 'center',
          px: 2,
          py: 1,
          borderRadius: 4,
          border: 1,
          borderColor: alpha(color, 0.5),
          bgcolor: alpha(color, phase === 'calm' ? 0.08 : 0.18),
          boxShadow: phase === 'calm' ? 'none' : TOKENS.glow(color, 0.45),
          transition: 'all 0.4s',
        }}
      >
        <ClockIcon sx={{ color }} />
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>
            {expired ? 'Your hold ran out' : 'Your seats are held'}
          </Typography>
          {expired ? (
            <Typography variant="caption" color="text.secondary">
              The seats went back on sale. They might still be free.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
              <Typography
                component="span"
                aria-live="off"
                sx={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, color, fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCountdown(msLeft)}
              </Typography>
              {/* Changes once a minute, so screen readers hear it calmly. */}
              <Typography component="span" variant="caption" color="text.secondary" aria-live="polite">
                {minutesMessage(msLeft, totalMs)}
              </Typography>
            </Stack>
          )}
        </Box>
      </Stack>

      {/* The seats and the total */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, flexGrow: 1 }}>
        {hold.seats.map((seat) => (
          <Chip
            key={seat.label}
            label={`${seat.label} · ${seat.zone} · ${formatAgorot(seat.priceAgorot)}`}
            sx={{
              bgcolor: expired ? 'transparent' : alpha(TOKENS.mine, 0.15),
              border: 1,
              borderColor: expired ? 'divider' : alpha(TOKENS.mine, 0.45),
              color: expired ? 'text.disabled' : 'info.main',
            }}
          />
        ))}
        <Typography sx={{ ml: 1 }}>
          <Typography component="span" variant="caption" color="text.secondary">
            Total{' '}
          </Typography>
          <Typography component="span" sx={{ fontSize: 22, fontWeight: 900 }}>
            {formatAgorot(hold.totalAgorot)}
          </Typography>
        </Typography>
      </Stack>

      {/* Actions */}
      {expired ? (
        <Button variant="contained" size="large" onClick={onHoldAgain} disabled={busy}>
          Try to hold them again
        </Button>
      ) : (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            label="Promo code"
            size="small"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="SAVE10"
            slotProps={{ htmlInput: { maxLength: 32 } }}
            sx={{ width: 130 }}
          />
          <Button
            variant="contained"
            size="large"
            onClick={() => onCheckout(promoCode.trim() || undefined)}
            disabled={busy}
            sx={{ px: 3 }}
          >
            {busy ? 'Working…' : 'Checkout'}
          </Button>
          <Button onClick={onRelease} disabled={busy} color="inherit" sx={{ color: 'text.secondary' }}>
            Release
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
