import { formatAgorot } from './money';

describe('formatAgorot: prices are stored in agorot, shown in shekels', () => {
  it('shows whole shekels without decimals', () => {
    expect(formatAgorot(30000)).toBe('₪300');
  });

  it('shows agorot when there are any', () => {
    expect(formatAgorot(34935)).toBe('₪349.35');
  });

  it('adds thousands separators', () => {
    expect(formatAgorot(123456700)).toBe('₪1,234,567');
  });
});
