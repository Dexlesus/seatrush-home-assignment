import { useEffect, useRef, useState } from 'react';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, '0');

/** 252000 → "4:12", 7503000 → "2:05:03", with days for far-away drops. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / SECOND));
  const days = Math.floor(total / (DAY / SECOND));
  const hours = Math.floor((total % (DAY / SECOND)) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (days > 0) {
    return `${days}d ${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

export type HoldPhase = 'calm' | 'warning' | 'urgent' | 'expired';

/** The colour of the hold countdown: calm → orange at 1:00 → red at 0:30. */
export function holdPhase(msLeft: number): HoldPhase {
  if (msLeft <= 0) return 'expired';
  if (msLeft <= 30 * SECOND) return 'urgent';
  if (msLeft <= MINUTE) return 'warning';
  return 'calm';
}

/** The calm reminder that updates once a minute: "4 min left · 1 min used". */
export function minutesMessage(msLeft: number, totalMs: number): string {
  if (msLeft < MINUTE) {
    return `${Math.max(0, Math.ceil(msLeft / SECOND))} seconds left. Check out now!`;
  }
  const left = Math.ceil(msLeft / MINUTE);
  const used = Math.max(0, Math.round(totalMs / MINUTE) - left);
  return `${left} min left · ${used} min used`;
}

/**
 * How far the server clock is from this computer's clock, from one more
 * sample (`serverNow` minus the moment its response ARRIVED here).
 *
 * The server reads its clock and then the answer travels, so every sample is
 * a little "behind" by the travel time. The largest sample is the most
 * accurate, so we keep it: a slow response can't make the countdown jump.
 * A change of more than 5 s means the clocks really moved: start over.
 */
export function nextClockOffset(current: number | null, sample: number): number {
  if (current === null || Math.abs(sample - current) > 5 * SECOND) {
    return sample;
  }
  return Math.max(current, sample);
}

/**
 * "Now" by the SERVER's clock, ticking every second.
 * The fan's computer clock may be wrong; the API sends `serverNow`, and we keep
 * the difference between the two clocks.
 *
 * @param receivedAt when that response arrived (RTK Query's
 *   `fulfilledTimeStamp`). Data from the cache can be minutes old: comparing
 *   its serverNow with the time of the response, not with "now", stays right.
 */
export function useServerNow(serverNow: string | undefined, receivedAt?: number): number {
  // How far the server clock is from this computer's clock.
  const offset = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (serverNow) {
      const sample = Date.parse(serverNow) - (receivedAt ?? Date.now());
      offset.current = nextClockOffset(offset.current, sample);
      setNow(Date.now() + offset.current);
    }
  }, [serverNow, receivedAt]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + (offset.current ?? 0)), SECOND);
    return () => clearInterval(timer);
  }, []);

  return now;
}
