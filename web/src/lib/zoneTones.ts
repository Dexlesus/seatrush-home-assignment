import type { Zone } from '../api/types';
import { TOKENS, ZONE_TONES } from '../theme';

export interface ZoneTone {
  tone: string;
  vip: boolean;
}

/** Each zone's colour, the most expensive first; that one is the gold "VIP". */
export function zoneTones(zones: Zone[]): Map<string, ZoneTone> {
  const byPrice = [...zones].sort((a, b) => b.priceAgorot - a.priceAgorot);
  return new Map(
    byPrice.map((zone, i) => [
      zone.name,
      { tone: ZONE_TONES[i % ZONE_TONES.length] ?? TOKENS.cyan, vip: i === 0 && zones.length > 1 },
    ]),
  );
}
