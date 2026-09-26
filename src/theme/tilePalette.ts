export interface TilePaletteEntry {
  readonly background: string;
  readonly text: string;
}

const TILE_PALETTE: Readonly<Record<number, TilePaletteEntry>> = {
  1: { background: '#EFE3C3', text: '#111111' },
  2: { background: '#EED6AC', text: '#111111' },
  3: { background: '#ECC995', text: '#111111' },
  4: { background: '#EABC7D', text: '#111111' },
  5: { background: '#E7AF64', text: '#111111' },
  6: { background: '#E3A064', text: '#111111' },
  7: { background: '#DE9064', text: '#111111' },
  8: { background: '#D98063', text: '#111111' },
  9: { background: '#D37062', text: '#111111' },
  10: { background: '#C76869', text: '#111111' },
  11: { background: '#BB606F', text: '#111111' },
  12: { background: '#AF5874', text: '#FFFFFF' },
  13: { background: '#A44F78', text: '#FFFFFF' },
  14: { background: '#944F7B', text: '#FFFFFF' },
  15: { background: '#844E7E', text: '#FFFFFF' },
  16: { background: '#744C80', text: '#FFFFFF' },
  17: { background: '#644A82', text: '#FFFFFF' },
  18: { background: '#544275', text: '#FFFFFF' },
  19: { background: '#443B68', text: '#FFFFFF' },
  20: { background: '#34335C', text: '#FFFFFF' },
};

const LAST_PALETTE_ENTRY = TILE_PALETTE[20];

export function tilePalette(exponent: number): TilePaletteEntry {
  if (!Number.isSafeInteger(exponent) || exponent < 1) {
    throw new RangeError('Tile exponent must be a positive safe integer.');
  }

  return exponent > 20 ? LAST_PALETTE_ENTRY : TILE_PALETTE[exponent];
}
