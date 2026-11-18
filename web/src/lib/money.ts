/** 30000 → "₪300", 34935 → "₪349.35". Prices are whole agorot (₪1 = 100). */
export function formatAgorot(agorot: number): string {
  const hasAgorot = agorot % 100 !== 0;
  const shekels = (agorot / 100).toLocaleString('en-US', {
    minimumFractionDigits: hasAgorot ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `₪${shekels}`;
}
