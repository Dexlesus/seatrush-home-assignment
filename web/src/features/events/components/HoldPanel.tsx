import { alpha, Box, Button, Chip, LinearProgress, Stack, TextField, Typography } from '@mui/material';
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

/** The hold: a live countdown (and a time bar) that changes colour, the seats, and checkout. */
export function HoldPanel({ hold, now, busy, onCheckout, onRelease, onHoldAgain }: Props) {
  const [promoCode, setPromoCode] = useState('');
  const msLeft = Date.parse(hold.expiresAt) - now;
  const totalMs = Date.parse(hold.expiresAt) - Date.parse(hold.createdAt);
  const phase = holdPhase(msLeft);
  const expired = phase === 'expired';
  const color = PHASE_COLOR[phase];
  const percentLeft = totalMs > 0 ? Math.max(0, Math.min(100, (msLeft / totalMs) * 100)) : 0;

  return (
    <Stack spacing={2}>
      {/* The countdown */}
      <Box
        sx={{
          p: 2,
          borderRadius: 4,
          border: 1,
          borderColor: alpha(color, 0.5),
          bgcolor: alpha(color, phase === 'calm' ? 0.08 : 0.16),
          boxShadow: phase === 'calm' ? 'none' : TOKENS.glow(color, 0.45),
          transition: 'all 0.4s',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <ClockIcon sx={{ fontSize: 18, color }} />
          <Typography sx={{ fontSize: 13, fontWeight: 800, color }}>
            {expired ? 'Your hold ran out' : 'Your seats are held'}
          </Typography>
        </Stack>
        {expired ? (
          <Typography variant="body2" color="text.secondary">
            The seats went back on sale. Try again: they might still be free.
          </Typography>
        ) : (
          <>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
              <Typography
                component="span"
                aria-live="off"
                sx={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, color, fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCountdown(msLeft)}
              </Typography>
              {/* Changes once a minute, so screen readers hear it calmly. */}
              <Typography component="span" variant="caption" color="text.secondary" aria-live="polite">
                {minutesMessage(msLeft, totalMs)}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={percentLeft}
              aria-label="Time left on your hold"
              sx={{
                mt: 1.25,
                height: 6,
                borderRadius: 99,
                bgcolor: alpha(color, 0.15),
                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 99, transition: 'transform 1s linear' },
              }}
            />
          </>
        )}
      </Box>

      {/* The seats and the total */}
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
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
      </Stack>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography color="text.secondary">Total</Typography>
        <Typography sx={{ fontSize: 26, fontWeight: 900 }}>{formatAgorot(hold.totalAgorot)}</Typography>
      </Stack>

      {/* Actions */}
      {expired ? (
        <Button variant="contained" size="large" onClick={onHoldAgain} disabled={busy} fullWidth>
          Try to hold them again
        </Button>
      ) : (
        <Stack spacing={1.25}>
          <TextField
            label="Promo code (optional)"
            size="small"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="SAVE10"
            fullWidth
            slotProps={{ htmlInput: { maxLength: 32 } }}
          />
          <Button
            variant="contained"
            size="large"
            onClick={() => onCheckout(promoCode.trim() || undefined)}
            disabled={busy}
            fullWidth
            sx={{ py: 1.5 }}
          >
            {busy ? 'Working…' : 'Checkout'}
          </Button>
          <Button onClick={onRelease} disabled={busy} color="inherit" sx={{ color: 'text.secondary' }}>
            Release these seats
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
