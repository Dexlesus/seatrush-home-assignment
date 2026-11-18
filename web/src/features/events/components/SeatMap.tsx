import { Box, ButtonBase, Chip, Stack, Tooltip, Typography } from '@mui/material';
import type { Seat, Zone } from '../../../api/types';
import { formatAgorot } from '../../../lib/money';
import { groupByRow } from '../../../lib/seats';
import { ZONE_PALETTE } from '../../../theme';

interface Props {
  seats: Seat[];
  zones: Zone[];
  selected: string[];
  mine: string[];
  onToggle: (label: string) => void;
}

type SeatLook = 'mine' | 'selected' | 'available' | 'held' | 'sold';

/** The seat map: row A nearest the stage, colours by zone and status. */
export function SeatMap({ seats, zones, selected, mine, onToggle }: Props) {
  const zoneColor = (zone: string) =>
    ZONE_PALETTE[Math.max(0, zones.findIndex((z) => z.name === zone)) % ZONE_PALETTE.length];

  function lookOf(seat: Seat): SeatLook {
    if (mine.includes(seat.label)) return 'mine';
    if (selected.includes(seat.label)) return 'selected';
    if (seat.status === 'AVAILABLE') return 'available';
    return seat.status === 'SOLD' ? 'sold' : 'held';
  }

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          py: 1,
          textAlign: 'center',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: 2,
          letterSpacing: 4,
          fontWeight: 700,
        }}
      >
        STAGE
      </Box>

      <Box sx={{ overflowX: 'auto', pb: 1 }}>
        <Stack spacing={0.75} sx={{ alignItems: 'center', minWidth: 'fit-content' }}>
          {groupByRow(seats).map(({ row, seats: rowSeats }) => (
            <Stack key={row} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Typography sx={{ width: 24, fontWeight: 700 }} color="text.secondary">
                {row}
              </Typography>
              {rowSeats.map((seat) => {
                const look = lookOf(seat);
                const color = zoneColor(seat.zone);
                const clickable = look === 'available' || look === 'selected';
                return (
                  <Tooltip
                    key={seat.label}
                    title={`${seat.label} · ${seat.zone} · ${formatAgorot(seat.priceAgorot)} · ${describe(look)}`}
                  >
                    <span>
                      <ButtonBase
                        aria-label={`Seat ${seat.label}, ${describe(look)}`}
                        aria-pressed={look === 'selected'}
                        disabled={!clickable}
                        onClick={() => onToggle(seat.label)}
                        sx={{
                          width: (t) => t.spacing(3.5),
                          height: (t) => t.spacing(3.5),
                          borderRadius: 1,
                          fontSize: 11,
                          fontWeight: 600,
                          border: 2,
                          transition: 'transform 0.1s',
                          '&:hover': clickable ? { transform: 'scale(1.12)' } : undefined,
                          ...LOOKS[look](color),
                        }}
                      >
                        {seat.seatNumber}
                      </ButtonBase>
                    </span>
                  </Tooltip>
                );
              })}
            </Stack>
          ))}
        </Stack>
      </Box>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {zones.map((zone) => (
          <Chip
            key={zone.name}
            variant="outlined"
            label={`${zone.name} · rows ${zone.fromRow}–${zone.toRow} · ${formatAgorot(zone.priceAgorot)}`}
            sx={{ borderColor: `${zoneColor(zone.name)}.main`, borderWidth: 2 }}
          />
        ))}
        <Chip label="Selected" color="primary" />
        <Chip label="Yours" color="success" />
        <Chip label="Held / sold" disabled />
      </Stack>
    </Stack>
  );
}

function describe(look: SeatLook): string {
  return {
    mine: 'held by you',
    selected: 'selected',
    available: 'available',
    held: 'held by someone',
    sold: 'sold',
  }[look];
}

/** The style of each kind of seat, from the theme's palette only. */
const LOOKS: Record<SeatLook, (zone: string) => object> = {
  mine: () => ({ bgcolor: 'success.main', color: 'success.contrastText', borderColor: 'success.dark' }),
  selected: () => ({ bgcolor: 'primary.main', color: 'primary.contrastText', borderColor: 'primary.dark' }),
  available: (zone) => ({ bgcolor: 'background.paper', color: 'text.primary', borderColor: `${zone}.main` }),
  held: () => ({ bgcolor: 'action.disabledBackground', color: 'text.disabled', borderColor: 'transparent' }),
  sold: () => ({ bgcolor: 'action.disabled', color: 'background.paper', borderColor: 'transparent' }),
};
