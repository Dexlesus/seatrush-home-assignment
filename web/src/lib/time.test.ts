import { formatCountdown, holdPhase, minutesMessage } from './time';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

describe('formatCountdown', () => {
  it('shows minutes and seconds under an hour', () => {
    expect(formatCountdown(4 * MINUTE + 12 * SECOND)).toBe('4:12');
    expect(formatCountdown(9 * SECOND)).toBe('0:09');
  });

  it('shows hours, and days for far-away drops', () => {
    expect(formatCountdown(2 * 60 * MINUTE + 5 * MINUTE + 3 * SECOND)).toBe('2:05:03');
    expect(formatCountdown(3 * 24 * 60 * MINUTE + 5 * SECOND)).toBe('3d 0:00:05');
  });

  it('never goes below zero', () => {
    expect(formatCountdown(-5 * SECOND)).toBe('0:00');
  });
});

describe('holdPhase: the colour of the hold countdown', () => {
  it('is calm with more than a minute left', () => {
    expect(holdPhase(3 * MINUTE)).toBe('calm');
  });

  it('warns (orange) from 1:00, and is urgent (red) from 0:30', () => {
    expect(holdPhase(MINUTE)).toBe('warning');
    expect(holdPhase(30 * SECOND)).toBe('urgent');
  });

  it('is expired at zero', () => {
    expect(holdPhase(0)).toBe('expired');
  });
});

describe('minutesMessage: the calm per-minute reminder', () => {
  it('says how many minutes are left and used', () => {
    expect(minutesMessage(3 * MINUTE + 10 * SECOND, 5 * MINUTE)).toBe(
      '4 min left · 1 min used',
    );
  });

  it('switches to seconds in the last minute', () => {
    expect(minutesMessage(42 * SECOND, 5 * MINUTE)).toBe('42 seconds left. Check out now!');
  });
});
