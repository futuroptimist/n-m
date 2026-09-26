export interface TileColors {
  background: string;
  text: string;
}

const tilePalette: readonly TileColors[] = [
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

export function tileColors(exponent: number): TileColors {
  return tilePalette[Math.min(exponent, tilePalette.length) - 1]!;
}
