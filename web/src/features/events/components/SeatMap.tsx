import { alpha, Box, Button, ButtonBase, Stack, Typography } from '@mui/material';
import { useId, useState, type ReactNode } from 'react';
import type { Seat, Zone } from '../../../api/types';
import { EyeIcon, InfoIcon, StarIcon, XIcon } from '../../../components/icons';
import { formatAgorot } from '../../../lib/money';
import { groupByRow } from '../../../lib/seats';
import { zoneTones, type ZoneTone } from '../../../lib/zoneTones';
import { TOKENS } from '../../../theme';

interface Props {
  seats: Seat[];
  zones: Zone[];
  selected: string[];
  mine: string[];
  onToggle: (label: string) => void;
}

type SeatLook = 'mine' | 'selected' | 'available' | 'held' | 'sold';


/** The seat map: the stage on top, row A nearest it, colours by zone and status. */
export function SeatMap({ seats, zones, selected, mine, onToggle }: Props) {
  const [hovered, setHovered] = useState<Seat | null>(null);
  const [is3D, setIs3D] = useState(true);
  /** A zone the fan wants to look at: the other zones are dimmed. */
  const [focusZone, setFocusZone] = useState<string | null>(null);
  const tones = zoneTones(zones);
  const toneOf = (zone: string): ZoneTone => tones.get(zone) ?? { tone: TOKENS.cyan, vip: false };

  function lookOf(seat: Seat): SeatLook {
    if (mine.includes(seat.label)) return 'mine';
    if (selected.includes(seat.label)) return 'selected';
    if (seat.status === 'AVAILABLE') return 'available';
    return seat.status === 'SOLD' ? 'sold' : 'held';
  }

  return (
    <Stack spacing={2} sx={{ alignItems: 'center' }}>
      {/* Zone filter + view toggle */}
      <Stack direction="row" sx={{ flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
        <ZoneTab active={focusZone === null} onClick={() => setFocusZone(null)}>
          All seats
        </ZoneTab>
        {zones.map((zone) => {
          const { tone, vip } = toneOf(zone.name);
          return (
            <ZoneTab
              key={zone.name}
              active={focusZone === zone.name}
              tone={tone}
              onClick={() => setFocusZone(focusZone === zone.name ? null : zone.name)}
            >
              {vip ? <StarIcon sx={{ fontSize: 13, color: tone, mr: 0.5 }} /> : null}
              {zone.name} ({formatAgorot(zone.priceAgorot)})
            </ZoneTab>
          );
        })}
        <Button
          size="small"
          onClick={() => setIs3D((v) => !v)}
          startIcon={<EyeIcon sx={{ fontSize: 16 }} />}
          sx={{
            borderRadius: 99,
            px: 1.75,
            border: 1,
            borderColor: is3D ? alpha(TOKENS.indigo[400], 0.4) : 'divider',
            bgcolor: is3D ? alpha(TOKENS.indigo[500], 0.2) : 'transparent',
            color: is3D ? TOKENS.indigo[300] : 'text.secondary',
          }}
        >
          {is3D ? 'Hall view (3D)' : 'Top view (2D)'}
        </Button>
      </Stack>

      <Stage />

      {/* What the mouse is on: a fixed-height strip (not a bubble), so it
          never covers a seat and the map never jumps. */}
      <Box sx={{ minHeight: 36, display: 'flex', alignItems: 'center' }} aria-live="polite">
        {hovered ? (
          <HoverInfo seat={hovered} look={lookOf(hovered)} {...toneOf(hovered.zone)} />
        ) : (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.disabled' }}>
            <InfoIcon sx={{ fontSize: 15 }} />
            <Typography variant="caption">Point at a seat to see its price and status, click to pick it</Typography>
          </Stack>
        )}
      </Box>

      {/* The seats. No scrolling: seats shrink to fit the width. */}
      <Box sx={{ width: '100%', overflow: 'hidden', py: 1 }}>
        <Stack
          spacing={{ xs: 0.5, sm: 0.75 }}
          onMouseLeave={() => setHovered(null)}
          sx={{
            mx: 'auto',
            px: { xs: 1, sm: 2 },
            py: 2.5,
            borderRadius: 6,
            bgcolor: alpha(TOKENS.slate[900], 0.4),
            border: 1,
            borderColor: alpha(TOKENS.slate[800], 0.6),
            transition: 'transform 0.5s',
            transformOrigin: 'center top',
            transform: is3D ? 'perspective(1100px) rotateX(14deg)' : 'none',
          }}
        >
          {groupByRow(seats).map(({ row, seats: rowSeats }) => {
            const vipRow = rowSeats.some((s) => toneOf(s.zone).vip);
            const rowLabel = (
              <Typography
                aria-hidden
                sx={{ width: 22, flexShrink: 0, textAlign: 'center', fontSize: 12, fontWeight: 800 }}
                color={vipRow ? 'warning.main' : 'text.disabled'}
              >
                {row}
              </Typography>
            );
            return (
              <Stack key={row} direction="row" sx={{ alignItems: 'center', justifyContent: 'center', gap: { xs: '2px', sm: '4px' } }}>
                {rowLabel}
                {rowSeats.map((seat) => {
                  const look = lookOf(seat);
                  const clickable = look === 'available' || look === 'selected';
                  const { tone, vip } = toneOf(seat.zone);
                  const dimmed = focusZone !== null && seat.zone !== focusZone;
                  return (
                    // Not `disabled`: a disabled button gets no mouse events,
                    // and the fan should still see WHY a seat can't be picked.
                    <ButtonBase
                      key={seat.label}
                      aria-label={`Seat ${seat.label}, ${describe(look)}`}
                      aria-pressed={look === 'selected'}
                      aria-disabled={!clickable}
                      onClick={() => clickable && onToggle(seat.label)}
                      onMouseEnter={() => setHovered(seat)}
                      onFocus={() => setHovered(seat)}
                      sx={{
                        flex: '1 1 0',
                        minWidth: 0,
                        maxWidth: 40,
                        borderRadius: 2,
                        p: '1px',
                        cursor: clickable ? 'pointer' : 'not-allowed',
                        transition: 'transform 0.2s, opacity 0.3s',
                        transform: look === 'selected' ? 'translateY(-3px) scale(1.05)' : 'none',
                        opacity: dimmed ? 0.2 : look === 'held' || look === 'sold' ? 0.55 : 1,
                        '&:hover': clickable ? { transform: 'translateY(-4px) scale(1.1)' } : undefined,
                        '&:active': clickable ? { transform: 'scale(0.95)' } : undefined,
                        '&.Mui-focusVisible': { outline: `2px solid ${TOKENS.cyan}` },
                      }}
                    >
                      <SeatIcon look={look} tone={tone} vip={vip} number={seat.seatNumber} />
                    </ButtonBase>
                  );
                })}
                {rowLabel}
              </Stack>
            );
          })}
        </Stack>
      </Box>

      <Legend zones={zones} toneOf={toneOf} />
    </Stack>
  );
}

function ZoneTab({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      size="small"
      onClick={onClick}
      aria-pressed={active}
      sx={{
        borderRadius: 99,
        px: 1.75,
        border: 1,
        fontSize: 12,
        borderColor: active ? TOKENS.slate[100] : TOKENS.slate[800],
        bgcolor: active ? TOKENS.slate[100] : alpha(TOKENS.slate[900], 0.7),
        color: active ? TOKENS.slate[950] : tone ?? 'text.secondary',
        boxShadow: active ? `0 0 20px ${alpha(TOKENS.slate[100], 0.2)}` : 'none',
        '&:hover': { bgcolor: active ? TOKENS.slate[100] : TOKENS.slate[800] },
      }}
    >
      {children}
    </Button>
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
          height: 80,
          mb: -6,
          opacity: 0.6,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse at top, ${alpha(TOKENS.sky[400], 0.28)} 0%, ${alpha(TOKENS.sky[400], 0.05)} 55%, transparent 80%)`,
        }}
      />
      <Box
        component="svg"
        viewBox="0 0 600 55"
        aria-hidden
        sx={{ width: '100%', overflow: 'visible', filter: `drop-shadow(0 6px 18px ${alpha(TOKENS.sky[400], 0.55)})` }}
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
  held: TOKENS.slate[600],
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
        width: '100%',
        display: 'grid',
        placeItems: 'center',
        filter: solid ? `drop-shadow(0 0 8px ${alpha(color, 0.75)})` : 'none',
      }}
    >
      <Box component="svg" viewBox="0 0 44 40" sx={{ width: '100%', height: 'auto', display: 'block' }}>
        <path d="M9 8 C9 5, 35 5, 35 8 L33 23 L11 23 Z" fill={backrest} stroke={stroke} strokeWidth="1.8" />
        <rect x="9" y="21" width="26" height="13" rx="4" fill={cushion} stroke={stroke} strokeWidth="1.8" />
        <rect x="5" y="16" width="4.5" height="17" rx="2.2" fill={arm} stroke={stroke} strokeWidth="1.4" />
        <rect x="34.5" y="16" width="4.5" height="17" rx="2.2" fill={arm} stroke={stroke} strokeWidth="1.4" />
        {vip && !taken ? (
          <line x1="14" y1="10" x2="30" y2="10" stroke={solid ? TOKENS.slate[950] : TOKENS.amber} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        ) : null}
        {/* The seat number, or an X when sold. Inside the SVG, so it scales with the seat. */}
        {look === 'sold' ? (
          <path d="M18 14 L26 22 M26 14 L18 22" stroke={TOKENS.slate[500]} strokeWidth="2" strokeLinecap="round" />
        ) : (
          <text
            x="22"
            y="19"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="12"
            fontWeight={solid ? 900 : 700}
            fill={solid ? TOKENS.slate[950] : taken ? TOKENS.slate[500] : TOKENS.slate[100]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {number}
          </text>
        )}
      </Box>
    </Box>
  );
}

/** What each kind of seat means, for the hover strip. */
const HOVER_TEXT: Record<SeatLook, { text: string; color: string }> = {
  available: { text: 'Available · click to pick', color: TOKENS.emerald },
  selected: { text: 'In your selection · click to remove', color: TOKENS.emerald },
  mine: { text: 'Held for you', color: TOKENS.mine },
  held: { text: 'Held by another fan · it may come back if their hold runs out', color: TOKENS.amber },
  sold: { text: 'Sold', color: TOKENS.rose },
};

function HoverInfo({ seat, look, tone, vip }: { seat: Seat; look: SeatLook } & ZoneTone) {
  const dot = <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.disabled', flexShrink: 0 }} />;
  const status = HOVER_TEXT[look];
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: 1.25,
        rowGap: 0.5,
        px: 2,
        py: 0.75,
        borderRadius: 99,
        bgcolor: alpha(TOKENS.slate[900], 0.95),
        border: 1,
        borderColor: alpha(status.color, 0.4),
      }}
    >
      <Typography sx={{ fontSize: 12, fontWeight: 800 }}>
        Row {seat.row} · Seat {seat.seatNumber}
      </Typography>
      {dot}
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: tone }}>
        {vip ? '★ ' : ''}
        {seat.zone}
      </Typography>
      {dot}
      <Typography sx={{ fontSize: 12, fontWeight: 900, color: 'primary.main' }}>{formatAgorot(seat.priceAgorot)}</Typography>
      {dot}
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: status.color }}>{status.text}</Typography>
    </Stack>
  );
}

function Legend({ zones, toneOf }: { zones: Zone[]; toneOf: (zone: string) => ZoneTone }) {
  const swatch = (bg: string, border: string, glow = false, children?: ReactNode) => (
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
  const item = (key: string, box: ReactNode, text: string, color = 'text.secondary') => (
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
        gap: { xs: 1.5, sm: 2.5 },
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
          `${zone.name} · rows ${zone.fromRow}–${zone.toRow}`,
          tone,
        );
      })}
      {item('selected', swatch(TOKENS.emerald, TOKENS.emerald, true), 'Your selection', 'primary.main')}
      {item('mine', swatch(TOKENS.mine, TOKENS.mine, true), 'Held for you', 'info.main')}
      {item('held', swatch(alpha(TOKENS.slate[600], 0.3), TOKENS.slate[600]), 'Held by someone')}
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
