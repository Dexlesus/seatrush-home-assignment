import { alpha, Box, Chip, Stack, Typography } from '@mui/material';
import type { Order } from '../api/types';
import { formatAgorot } from '../lib/money';
import { TOKENS } from '../theme';
import { CalendarIcon, MapPinIcon, SparklesIcon, TicketIcon } from './icons';

/** A bought order, drawn as a ticket: the show on top, a tear line, the seats below. */
export function TicketStub({ order }: { order: Order }) {
  const notch = (side: 'left' | 'right') => ({
    position: 'absolute' as const,
    top: '50%',
    [side]: -12,
    width: 24,
    height: 24,
    borderRadius: '50%',
    bgcolor: 'background.default',
    transform: 'translateY(-50%)',
  });

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 6,
        overflow: 'hidden',
        border: 1,
        borderColor: TOKENS.slate[700],
        background: `linear-gradient(135deg, ${TOKENS.slate[800]}, ${TOKENS.slate[950]})`,
        boxShadow: `0 20px 40px ${alpha(TOKENS.slate[950], 0.6)}`,
      }}
    >
      {/* The show */}
      <Stack direction="row" spacing={2} sx={{ p: 2.5, alignItems: 'center' }}>
        <Box
          sx={{
            width: 52,
            height: 68,
            flexShrink: 0,
            borderRadius: 3,
            p: '1px',
            background: TOKENS.poster,
            boxShadow: TOKENS.glow(TOKENS.cyan, 0.25),
          }}
        >
          <Box sx={{ width: '100%', height: '100%', borderRadius: 2.75, bgcolor: alpha(TOKENS.slate[950], 0.8), display: 'grid', placeItems: 'center' }}>
            <SparklesIcon sx={{ fontSize: 20, color: 'secondary.main' }} />
          </Box>
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', color: 'secondary.main' }}>
            SEATRUSH · E-TICKET
          </Typography>
          <Typography variant="h6" noWrap>
            {order.eventName}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, color: 'text.secondary' }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <MapPinIcon sx={{ fontSize: 14, color: 'secondary.main' }} />
              <Typography variant="caption">{order.venue}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <CalendarIcon sx={{ fontSize: 14, color: 'primary.main' }} />
              <Typography variant="caption">{new Date(order.startsAt).toLocaleString()}</Typography>
            </Stack>
          </Stack>
        </Box>
        <Stack sx={{ alignItems: 'center', flexShrink: 0, pl: 2, borderLeft: 1, borderColor: 'divider' }}>
          <TicketIcon sx={{ color: 'primary.main' }} />
          <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary' }}>
            ADMIT
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{order.seats.length}</Typography>
        </Stack>
      </Stack>

      {/* The tear line */}
      <Box sx={{ position: 'relative', borderTop: '1px dashed', borderColor: TOKENS.slate[700], mx: 2 }}>
        <Box sx={notch('left')} />
        <Box sx={notch('right')} />
      </Box>

      {/* The seats and the price */}
      <Stack spacing={1.5} sx={{ p: 2.5 }}>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {order.seats.map((seat) => (
            <Chip
              key={seat.label}
              label={`Row ${seat.label.replace(/\d+$/, '')} · Seat ${seat.label.replace(/^[A-Z]+/, '')} · ${seat.zone}`}
              size="small"
              sx={{
                bgcolor: alpha(TOKENS.emerald, 0.15),
                border: 1,
                borderColor: alpha(TOKENS.emerald, 0.3),
                color: 'primary.main',
              }}
            />
          ))}
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Order <code>{order.orderId.slice(0, 8)}</code> · bought {new Date(order.createdAt).toLocaleString()}
            </Typography>
            {order.promoCode ? (
              <Typography variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
                {formatAgorot(order.subtotalAgorot)} − {formatAgorot(order.discountAgorot)} with {order.promoCode}
              </Typography>
            ) : null}
          </Box>
          <Typography sx={{ fontSize: 22, fontWeight: 900, color: 'primary.main' }}>
            {formatAgorot(order.totalAgorot)}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
