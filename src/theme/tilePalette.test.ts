import assert from 'node:assert/strict';
import test from 'node:test';

import { tilePalette, type TilePaletteEntry } from './tilePalette';

const expectedPalette: readonly TilePaletteEntry[] = [
  { background: '#EFE3C3', text: '#111111' },
  { background: '#EED6AC', text: '#111111' },
  { background: '#ECC995', text: '#111111' },
  { background: '#EABC7D', text: '#111111' },
  { background: '#E7AF64', text: '#111111' },
  { background: '#E3A064', text: '#111111' },
  { background: '#DE9064', text: '#111111' },
  { background: '#D98063', text: '#111111' },
  { background: '#D37062', text: '#111111' },
  { background: '#C76869', text: '#111111' },
  { background: '#BB606F', text: '#111111' },
  { background: '#AF5874', text: '#FFFFFF' },
  { background: '#A44F78', text: '#FFFFFF' },
  { background: '#944F7B', text: '#FFFFFF' },
  { background: '#844E7E', text: '#FFFFFF' },
  { background: '#744C80', text: '#FFFFFF' },
  { background: '#644A82', text: '#FFFFFF' },
  { background: '#544275', text: '#FFFFFF' },
  { background: '#443B68', text: '#FFFFFF' },
  { background: '#34335C', text: '#FFFFFF' },
];

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  assert.ok(channels);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

test('maps every exponent from 1 through 20 to the exact fixed palette', () => {
  expectedPalette.forEach((expected, index) => {
    assert.deepEqual(tilePalette(index + 1), expected);
  });
});

test('uses twenty distinct backgrounds with the expected color boundaries', () => {
  assert.equal(
    new Set(expectedPalette.map(({ background }) => background)).size,
    20,
  );
  assert.deepEqual(tilePalette(1), {
    background: '#EFE3C3',
    text: '#111111',
  });
  assert.deepEqual(tilePalette(11), {
    background: '#BB606F',
    text: '#111111',
  });
  assert.deepEqual(tilePalette(12), {
    background: '#AF5874',
    text: '#FFFFFF',
  });
  assert.deepEqual(tilePalette(20), {
    background: '#34335C',
    text: '#FFFFFF',
  });
});

test('reuses exponent 20 colors beyond the palette without capping values', () => {
  assert.deepEqual(tilePalette(21), expectedPalette[19]);
  assert.deepEqual(tilePalette(1_000_000), expectedPalette[19]);
});

test('provides at least 4.5:1 contrast for every palette entry', () => {
  expectedPalette.forEach(({ background, text }, index) => {
    assert.ok(
      contrastRatio(background, text) >= 4.5,
      `exponent ${index + 1} must meet 4.5:1 contrast`,
    );
  });
});
