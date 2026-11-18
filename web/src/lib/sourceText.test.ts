/**
 * Guards against "mojibake": UTF-8 text read with the wrong encoding and saved
 * again, so "·" becomes "Â·" and "–" becomes "â€“". It happened once (a script
 * re-saved a file), and the fan saw gibberish on the seat map.
 */
const BROKEN = /Â[·–—]|â€|â˜|Ã[©¨ ]/;

// Every web source file, as text (Vite loads them; no Node APIs needed).
const files = import.meta.glob<string>(['/src/**/*.{ts,tsx,css}', '/index.html', '!**/sourceText.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('source text', () => {
  it('reads the source files', () => {
    expect(Object.keys(files).length).toBeGreaterThan(20);
  });

  it('has no broken characters (mojibake) in any web source file', () => {
    const broken = Object.entries(files).flatMap(([file, text]) =>
      text
        .split('\n')
        .map((line, i) => ({ file, line: i + 1, text: line.trim() }))
        .filter((entry) => BROKEN.test(entry.text)),
    );

    expect(broken).toEqual([]);
  });
});
