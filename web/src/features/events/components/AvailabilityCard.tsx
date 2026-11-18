import { alpha, Box, Card, CardContent, LinearProgress, Stack, Typography } from '@mui/material';
import type { Seat, Zone } from '../../../api/types';
import { StarIcon } from '../../../components/icons';
import { formatAgorot } from '../../../lib/money';
import { zoneTones } from '../../../lib/zoneTones';
import { TOKENS } from '../../../theme';

/** How many seats are still free, overall and per zone. Live (the map polls). */
export function AvailabilityCard({ seats, zones }: { seats: Seat[]; zones: Zone[] }) {
  const tones = zoneTones(zones);
  const free = seats.filter((s) => s.status === 'AVAILABLE').length;
  const percent = seats.length > 0 ? (free / seats.length) * 100 : 0;
  const almostGone = percent > 0 && percent <= 15;

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Seats left
            </Typography>
            <Typography sx={{ fontWeight: 900, color: almostGone ? 'warning.main' : 'text.primary' }}>
              {free}
              <Typography component="span" variant="caption" color="text.secondary">
                {' '}
                of {seats.length}
              </Typography>
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={percent}
            aria-label="Seats left"
            sx={{
              height: 8,
              borderRadius: 99,
              bgcolor: alpha(TOKENS.slate[700], 0.4),
              '& .MuiLinearProgress-bar': { borderRadius: 99, bgcolor: almostGone ? 'warning.main' : 'primary.main' },
            }}
          />
          {free === 0 ? (
            <Typography variant="caption" color="error">
              Sold out right now. Held seats come back if a hold runs out, so keep this page open.
            </Typography>
          ) : almostGone ? (
            <Typography variant="caption" color="warning.main">
              Almost gone!
            </Typography>
          ) : null}

          {zones.map((zone) => {
            const inZone = seats.filter((s) => s.zone === zone.name);
            const left = inZone.filter((s) => s.status === 'AVAILABLE').length;
            const { tone, vip } = tones.get(zone.name) ?? { tone: TOKENS.cyan, vip: false };
            return (
              <Box key={zone.name}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: tone, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ fontWeight: 700, color: tone, flexGrow: 1 }}>
                    {vip ? <StarIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: '-1px' }} /> : null}
                    {zone.name} · {formatAgorot(zone.priceAgorot)}
                  </Typography>
                  <Typography variant="caption" color={left === 0 ? 'error' : 'text.secondary'}>
                    {left === 0 ? 'sold out' : `${left} left`}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={inZone.length > 0 ? (left / inZone.length) * 100 : 0}
                  aria-label={`${zone.name} seats left`}
                  sx={{
                    mt: 0.5,
                    height: 4,
                    borderRadius: 99,
                    bgcolor: alpha(tone, 0.12),
                    '& .MuiLinearProgress-bar': { borderRadius: 99, bgcolor: tone },
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
