import assert from 'node:assert/strict';
import test from 'node:test';

import { tileColors } from './tilePalette';

const expected = [
  ['#EFE3C3', '#111111'],
  ['#EED6AC', '#111111'],
  ['#ECC995', '#111111'],
  ['#EABC7D', '#111111'],
  ['#E7AF64', '#111111'],
  ['#E3A064', '#111111'],
  ['#DE9064', '#111111'],
  ['#D98063', '#111111'],
  ['#D37062', '#111111'],
  ['#C76869', '#111111'],
  ['#BB606F', '#111111'],
  ['#AF5874', '#FFFFFF'],
  ['#A44F78', '#FFFFFF'],
  ['#944F7B', '#FFFFFF'],
  ['#844E7E', '#FFFFFF'],
  ['#744C80', '#FFFFFF'],
  ['#644A82', '#FFFFFF'],
  ['#544275', '#FFFFFF'],
  ['#443B68', '#FFFFFF'],
  ['#34335C', '#FFFFFF'],
] as const;

test('maps exponents 1 through 20 to the exact palette', () => {
  expected.forEach(([background, text], index) => {
    assert.deepEqual(tileColors(index + 1), { background, text });
  });
});

test('uses distinct backgrounds and the specified palette boundaries', () => {
  assert.equal(new Set(expected.map(([background]) => background)).size, 20);
  for (const exponent of [1, 11, 12, 20]) {
    const [background, text] = expected[exponent - 1]!;
    assert.deepEqual(tileColors(exponent), { background, text });
  }
});

test('retains the exponent-20 colors beyond the palette without capping values', () => {
  const fallback = { background: '#34335C', text: '#FFFFFF' };
  assert.deepEqual(tileColors(21), fallback);
  assert.deepEqual(tileColors(1_000_000), fallback);
});

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

test('provides at least 4.5:1 text contrast for every palette entry', () => {
  expected.forEach(([background, text], index) => {
    const backgroundLuminance = relativeLuminance(background);
    const textLuminance = relativeLuminance(text);
    const contrast =
      (Math.max(backgroundLuminance, textLuminance) + 0.05) /
      (Math.min(backgroundLuminance, textLuminance) + 0.05);
    assert.ok(
      contrast >= 4.5,
      `exponent ${index + 1} contrast was ${contrast}`,
    );
  });
});
