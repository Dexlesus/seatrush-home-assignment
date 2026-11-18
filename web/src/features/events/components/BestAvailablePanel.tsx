import {
  alpha,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import type { HoldBody, Seat, Zone } from '../../../api/types';
import { SparklesIcon, UsersIcon } from '../../../components/icons';
import { formatAgorot } from '../../../lib/money';
import { largestBlockAvailable } from '../../../lib/seats';
import { TOKENS } from '../../../theme';

interface Props {
  seats: Seat[];
  zones: Zone[];
  /** The most seats this fan may still take (rule 4), at most 4. */
  maxCount: number;
  disabled: boolean;
  onFind: (body: HoldBody) => void;
}

/**
 * Rule 7 from the fan's side: "N seats together". Before the fan clicks, the
 * screen already knows the most seats together that are free right now, and
 * greys out the counts that can't fit. (The server still decides.)
 */
export function BestAvailablePanel({ seats, zones, maxCount, disabled, onFind }: Props) {
  const [chosen, setCount] = useState(2);
  // Never more than the fan may still take (after buying 3, only "1 together").
  const count = Math.max(1, Math.min(chosen, maxCount));
  const [zone, setZone] = useState('');
  // '' = any price; otherwise the max price in agorot, as text (Select values).
  const [maxPrice, setMaxPrice] = useState('');
  const maxPriceAgorot = maxPrice === '' ? null : Number(maxPrice);

  const largest = useMemo(() => {
    const matching = seats.filter(
      (seat) =>
        (zone === '' || seat.zone === zone) &&
        (maxPriceAgorot === null || seat.priceAgorot <= maxPriceAgorot),
    );
    return largestBlockAvailable(matching);
  }, [seats, zone, maxPriceAgorot]);

  const prices = [...new Set(zones.map((z) => z.priceAgorot))].sort((a, b) => a - b);
  const fits = count <= largest;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <SparklesIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          Best available
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ mt: '-4px !important' }}>
        We pick the row nearest the stage, then the most central seats.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <UsersIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          Seats together
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={count}
          onChange={(_e, value: number | null) => value && setCount(value)}
          aria-label="How many seats together"
          sx={{ gap: 0.5, '& .MuiToggleButtonGroup-grouped': { border: 0, borderRadius: '8px !important' } }}
        >
          {[1, 2, 3, 4].map((n) => (
            <ToggleButton
              key={n}
              value={n}
              disabled={n > largest || n > maxCount}
              aria-label={`${n} together`}
              sx={{
                width: 34,
                height: 32,
                fontWeight: 800,
                bgcolor: alpha(TOKENS.slate[950], 0.6),
                '&.Mui-selected, &.Mui-selected:hover': {
                  bgcolor: 'secondary.main',
                  color: 'secondary.contrastText',
                  boxShadow: TOKENS.glow(TOKENS.cyan, 0.5),
                },
              }}
            >
              {n}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Stack direction="row" spacing={1}>
        <FormControl size="small" fullWidth>
          <InputLabel id="zone-label">Zone</InputLabel>
          <Select labelId="zone-label" label="Zone" value={zone} onChange={(e) => setZone(e.target.value)}>
            <MenuItem value="">Any zone</MenuItem>
            {zones.map((z) => (
              <MenuItem key={z.name} value={z.name}>
                {z.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel id="price-label">Max price</InputLabel>
          <Select labelId="price-label" label="Max price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}>
            <MenuItem value="">Any price</MenuItem>
            {prices.map((p) => (
              <MenuItem key={p} value={String(p)}>
                Up to {formatAgorot(p)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Button
        disabled={disabled || !fits}
        fullWidth
        startIcon={<SparklesIcon sx={{ fontSize: 16 }} />}
        onClick={() =>
          onFind({
            bestAvailable: {
              count,
              ...(zone ? { zone } : {}),
              ...(maxPriceAgorot !== null ? { maxPriceAgorot } : {}),
            },
          })
        }
        sx={{
          py: 1.1,
          color: 'secondary.main',
          bgcolor: alpha(TOKENS.cyan, 0.15),
          border: 1,
          borderColor: alpha(TOKENS.cyan, 0.3),
          '&:hover': { bgcolor: alpha(TOKENS.cyan, 0.25) },
        }}
      >
        Find {count} together
      </Button>
      <Typography variant="caption" color={largest === 0 ? 'error' : 'text.secondary'}>
        {largest === 0
          ? 'No free seats match these filters right now.'
          : `Right now the most seats together is ${largest}.`}
      </Typography>
    </Stack>
  );
}
