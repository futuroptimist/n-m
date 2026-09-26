export const colors = {
  background: '#f6f2e9',
  board: '#8c7f70',
  empty: '#d8cec0',
  ink: '#27231f',
  mutedInk: '#5f574e',
  panel: '#fffdf8',
  primary: '#365b4d',
  primaryPressed: '#29473c',
  white: '#ffffff',
} as const;

export { tileColors, type TileColors } from './tilePalette';

export const spacing = {
  small: 8,
  medium: 16,
  large: 24,
} as const;
