import {
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
import { formatAgorot } from '../../../lib/money';
import { largestBlockAvailable } from '../../../lib/seats';

interface Props {
  seats: Seat[];
  zones: Zone[];
  disabled: boolean;
  onFind: (body: HoldBody) => void;
}

/**
 * Rule 7 from the fan's side: "N seats together". Before the fan clicks, the
 * screen already knows the most seats together that are free right now, and
 * greys out the counts that can't fit. (The server still decides.)
 */
export function BestAvailablePanel({ seats, zones, disabled, onFind }: Props) {
  const [count, setCount] = useState(2);
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
      <Typography variant="subtitle1">Best available</Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={count}
        onChange={(_e, value: number | null) => value && setCount(value)}
        aria-label="How many seats together"
      >
        {[1, 2, 3, 4].map((n) => (
          <ToggleButton key={n} value={n} disabled={n > largest}>
            {n} together
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Stack direction="row" spacing={1}>
        <FormControl size="small" fullWidth>
          <InputLabel id="zone-label">Zone</InputLabel>
          <Select
            labelId="zone-label"
            label="Zone"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          >
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
          <Select
            labelId="price-label"
            label="Max price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          >
            <MenuItem value="">Any price</MenuItem>
            {prices.map((p) => (
              <MenuItem key={p} value={String(p)}>
                Up to {formatAgorot(p)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      <Typography variant="body2" color={largest === 0 ? 'error' : 'text.secondary'}>
        {largest === 0
          ? 'No free seats match these filters right now.'
          : `Right now the most seats together is ${largest}.`}
      </Typography>
      <Button
        variant="outlined"
        disabled={disabled || !fits}
        onClick={() =>
          onFind({
            bestAvailable: {
              count,
              ...(zone ? { zone } : {}),
              ...(maxPriceAgorot !== null ? { maxPriceAgorot } : {}),
            },
          })
        }
      >
        Find {count} together
      </Button>
    </Stack>
  );
}
