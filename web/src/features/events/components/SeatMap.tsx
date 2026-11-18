import { alpha, Box, Button, ButtonBase, Stack, Typography } from '@mui/material';
import { useId, useState } from 'react';
import type { Seat, Zone } from '../../../api/types';
import { EyeIcon, InfoIcon, StarIcon, XIcon } from '../../../components/icons';
import { formatAgorot } from '../../../lib/money';
import { groupByRow } from '../../../lib/seats';
import { TOKENS, ZONE_TONES } from '../../../theme';

interface Props {
  seats: Seat[];
  zones: Zone[];
  selected: string[];
  mine: string[];
  onToggle: (label: string) => void;
}

type SeatLook = 'mine' | 'selected' | 'available' | 'held' | 'sold';

/** Each zone's colour, the most expensive first; that one is the gold "VIP". */
function zoneTones(zones: Zone[]) {
  const byPrice = [...zones].sort((a, b) => b.priceAgorot - a.priceAgorot);
  return new Map(
    byPrice.map((zone, i) => [
      zone.name,
      { tone: ZONE_TONES[i % ZONE_TONES.length] ?? TOKENS.cyan, vip: i === 0 && zones.length > 1 },
    ]),
  );
}

/** The seat map: the stage on top, row A nearest it, colours by zone and status. */
export function SeatMap({ seats, zones, selected, mine, onToggle }: Props) {
  const [hovered, setHovered] = useState<Seat | null>(null);
  const [is3D, setIs3D] = useState(true);
  const tones = zoneTones(zones);
  const toneOf = (zone: string) => tones.get(zone) ?? { tone: TOKENS.cyan, vip: false };

  function lookOf(seat: Seat): SeatLook {
    if (mine.includes(seat.label)) return 'mine';
    if (selected.includes(seat.label)) return 'selected';
    if (seat.status === 'AVAILABLE') return 'available';
    return seat.status === 'SOLD' ? 'sold' : 'held';
  }

  return (
    <Stack spacing={2} sx={{ alignItems: 'center' }}>
      <Stage />

      {/* What the mouse is on. A fixed-height strip (not a bubble), so it
          never covers a seat and the map never jumps. */}
      <Box sx={{ height: 36, display: 'flex', alignItems: 'center' }} aria-live="polite">
        {hovered ? (
          <HoverInfo seat={hovered} look={lookOf(hovered)} {...toneOf(hovered.zone)} />
        ) : (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.disabled' }}>
            <InfoIcon sx={{ fontSize: 15 }} />
            <Typography variant="caption">Point at a seat to see its price, click to pick it</Typography>
          </Stack>
        )}
      </Box>

      <Box sx={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center', pb: 1 }}>
        <Stack
          spacing={{ xs: 0.75, sm: 1 }}
          onMouseLeave={() => setHovered(null)}
          sx={{
            px: 2,
            py: 3,
            borderRadius: 6,
            bgcolor: alpha(TOKENS.slate[900], 0.4),
            border: 1,
            borderColor: alpha(TOKENS.slate[800], 0.6),
            minWidth: 'fit-content',
            transition: 'transform 0.5s',
            transformOrigin: 'center top',
            transform: is3D ? 'perspective(1100px) rotateX(14deg)' : 'none',
          }}
        >
          {groupByRow(seats).map(({ row, seats: rowSeats }) => {
            const vipRow = rowSeats.some((s) => toneOf(s.zone).vip);
            const label = (
              <Typography
                sx={{ width: 24, textAlign: 'center', fontSize: 12, fontWeight: 800 }}
                color={vipRow ? 'warning.main' : 'text.disabled'}
              >
                {row}
              </Typography>
            );
            return (
              <Stack key={row} direction="row" spacing={{ xs: 0.25, sm: 0.5 }} sx={{ alignItems: 'center', justifyContent: 'center' }}>
                {label}
                {rowSeats.map((seat) => {
                  const look = lookOf(seat);
                  const clickable = look === 'available' || look === 'selected';
                  const { tone, vip } = toneOf(seat.zone);
                  return (
                    <ButtonBase
                      key={seat.label}
                      aria-label={`Seat ${seat.label}, ${describe(look)}`}
                      aria-pressed={look === 'selected'}
                      disabled={!clickable}
                      onClick={() => onToggle(seat.label)}
                      onMouseEnter={() => setHovered(seat)}
                      onFocus={() => setHovered(seat)}
                      sx={{
                        borderRadius: 2,
                        p: 0.25,
                        transition: 'transform 0.2s',
                        transform: look === 'selected' ? 'translateY(-4px) scale(1.05)' : 'none',
                        '&:hover': clickable ? { transform: 'translateY(-4px) scale(1.1)' } : undefined,
                        '&:active': clickable ? { transform: 'scale(0.95)' } : undefined,
                        '&.Mui-focusVisible': { outline: `2px solid ${TOKENS.cyan}` },
                        opacity: look === 'held' || look === 'sold' ? 0.55 : 1,
                      }}
                    >
                      <SeatIcon look={look} tone={tone} vip={vip} number={seat.seatNumber} />
                    </ButtonBase>
                  );
                })}
                {label}
              </Stack>
            );
          })}
        </Stack>
      </Box>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
        <Button
          size="small"
          onClick={() => setIs3D((v) => !v)}
          startIcon={<EyeIcon sx={{ fontSize: 16 }} />}
          sx={{
            borderRadius: 3,
            border: 1,
            borderColor: is3D ? alpha(TOKENS.indigo[400], 0.4) : 'divider',
            bgcolor: is3D ? alpha(TOKENS.indigo[500], 0.2) : 'transparent',
            color: is3D ? TOKENS.indigo[300] : 'text.secondary',
          }}
        >
          {is3D ? 'Hall view (3D)' : 'Top view (2D)'}
        </Button>
      </Stack>

      <Legend zones={zones} toneOf={toneOf} />
    </Stack>
  );
}

/** The curved, glowing stage with a soft beam of light toward the seats. */
function Stage() {
  const gradientId = useId();
  return (
    <Box sx={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box
        aria-hidden
        sx={{
          width: '88%',
          height: 96,
          mb: -7,
          opacity: 0.6,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse at top, ${alpha(TOKENS.sky[400], 0.28)} 0%, ${alpha(TOKENS.sky[400], 0.05)} 55%, transparent 80%)`,
        }}
      />
      <Box
        component="svg"
        viewBox="0 0 600 55"
        aria-hidden
        sx={{ width: '100%', maxWidth: 680, overflow: 'visible', filter: `drop-shadow(0 6px 18px ${alpha(TOKENS.sky[400], 0.55)})` }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={TOKENS.sky[600]} stopOpacity="0.2" />
            <stop offset="25%" stopColor={TOKENS.sky[400]} stopOpacity="0.95" />
            <stop offset="50%" stopColor={TOKENS.sky[100]} stopOpacity="1" />
            <stop offset="75%" stopColor={TOKENS.sky[400]} stopOpacity="0.95" />
            <stop offset="100%" stopColor={TOKENS.sky[600]} stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path d="M 30 42 Q 300 4 570 42" fill="none" stroke={`url(#${gradientId})`} strokeWidth="6" strokeLinecap="round" />
      </Box>
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.25em', color: alpha(TOKENS.cyan, 0.7), mt: -1.5 }}>
        STAGE
      </Typography>
    </Box>
  );
}

const SEAT_COLORS: Record<SeatLook, string> = {
  selected: TOKENS.emerald,
  mine: TOKENS.mine,
  available: '',
  held: TOKENS.slate[700],
  sold: TOKENS.slate[800],
};

/** One seat, drawn as an armchair: backrest, cushion, two armrests. */
function SeatIcon({ look, tone, vip, number }: { look: SeatLook; tone: string; vip: boolean; number: number }) {
  const solid = look === 'selected' || look === 'mine';
  const taken = look === 'held' || look === 'sold';
  const color = look === 'available' ? tone : SEAT_COLORS[look];

  const backrest = solid ? color : alpha(color, taken ? 0.25 : vip ? 0.35 : 0.22);
  const cushion = solid ? color : alpha(color, taken ? 0.2 : 0.15);
  const arm = solid ? color : alpha(color, taken ? 0.3 : 0.4);
  const stroke = alpha(color, taken ? 0.5 : 0.85);

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        filter: solid ? `drop-shadow(0 0 8px ${alpha(color, 0.75)})` : 'none',
      }}
    >
      <Box component="svg" viewBox="0 0 44 40" sx={{ width: { xs: 28, sm: 34 }, height: { xs: 25, sm: 31 } }}>
        <path d="M9 8 C9 5, 35 5, 35 8 L33 23 L11 23 Z" fill={backrest} stroke={stroke} strokeWidth="1.8" />
        <rect x="9" y="21" width="26" height="13" rx="4" fill={cushion} stroke={stroke} strokeWidth="1.8" />
        <rect x="5" y="16" width="4.5" height="17" rx="2.2" fill={arm} stroke={stroke} strokeWidth="1.4" />
        <rect x="34.5" y="16" width="4.5" height="17" rx="2.2" fill={arm} stroke={stroke} strokeWidth="1.4" />
        {vip && !taken ? (
          <line x1="14" y1="10" x2="30" y2="10" stroke={solid ? TOKENS.slate[950] : TOKENS.amber} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        ) : null}
      </Box>
      <Box
        component="span"
        sx={{
          position: 'absolute',
          top: '46%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: { xs: 9, sm: 11 },
          fontWeight: solid ? 900 : 700,
          lineHeight: 1,
          pointerEvents: 'none',
          userSelect: 'none',
          color: solid ? TOKENS.slate[950] : taken ? TOKENS.slate[600] : TOKENS.slate[100],
        }}
      >
        {look === 'sold' ? <XIcon sx={{ fontSize: 12 }} /> : number}
      </Box>
    </Box>
  );
}

function HoverInfo({ seat, look, tone, vip }: { seat: Seat; look: SeatLook; tone: string; vip: boolean }) {
  const dot = <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.disabled' }} />;
  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        alignItems: 'center',
        px: 2,
        py: 0.75,
        borderRadius: 99,
        bgcolor: alpha(TOKENS.slate[900], 0.95),
        border: 1,
        borderColor: alpha(TOKENS.slate[700], 0.8),
        fontSize: 12,
      }}
    >
      <Typography sx={{ fontSize: 12, fontWeight: 800 }}>
        Row {seat.row} Â· Seat {seat.seatNumber}
      </Typography>
      {dot}
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: tone }}>
        {vip ? 'â˜… ' : ''}
        {seat.zone}
      </Typography>
      {dot}
      <Typography sx={{ fontSize: 12, fontWeight: 900, color: 'primary.main' }}>{formatAgorot(seat.priceAgorot)}</Typography>
      {dot}
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{describe(look)}</Typography>
    </Stack>
  );
}

function Legend({ zones, toneOf }: { zones: Zone[]; toneOf: (zone: string) => { tone: string; vip: boolean } }) {
  const swatch = (bg: string, border: string, glow = false, children?: React.ReactNode) => (
    <Box
      sx={{
        width: 18,
        height: 18,
        borderRadius: 1,
        bgcolor: bg,
        border: 1,
        borderColor: border,
        boxShadow: glow ? TOKENS.glow(border) : 'none',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {children}
    </Box>
  );
  const item = (key: string, box: React.ReactNode, text: string, color = 'text.secondary') => (
    <Stack key={key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      {box}
      <Typography variant="caption" sx={{ color, fontWeight: 600 }}>
        {text}
      </Typography>
    </Stack>
  );

  return (
    <Stack
      direction="row"
      sx={{
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: { xs: 2, sm: 3 },
        px: 3,
        py: 1.5,
        borderRadius: 4,
        bgcolor: alpha(TOKENS.slate[900], 0.7),
        border: 1,
        borderColor: alpha(TOKENS.slate[800], 0.8),
      }}
    >
      {zones.map((zone) => {
        const { tone, vip } = toneOf(zone.name);
        return item(
          zone.name,
          swatch(alpha(tone, 0.2), tone, false, vip ? <StarIcon sx={{ fontSize: 10, color: tone }} /> : null),
          `${zone.name} Â· rows ${zone.fromRow}â€“${zone.toRow} Â· ${formatAgorot(zone.priceAgorot)}`,
          tone,
        );
      })}
      {item('selected', swatch(TOKENS.emerald, TOKENS.emerald, true), 'Your selection', 'primary.main')}
      {item('mine', swatch(TOKENS.mine, TOKENS.mine, true), 'Held for you', 'info.main')}
      {item('held', swatch(alpha(TOKENS.slate[700], 0.4), TOKENS.slate[700]), 'Held by someone')}
      {item('sold', swatch(TOKENS.slate[900], TOKENS.slate[800], false, <XIcon sx={{ fontSize: 11, color: 'text.disabled' }} />), 'Sold')}
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
