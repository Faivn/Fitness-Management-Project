import { Platform } from 'react-native';

/**
 * Mova design tokens, following DESIGN.md (v2.1, mobile-first): blush-white page,
 * white cards, one berry-rose accent, lilac for the companion, system type, very round shapes. Some older names (canvas,
 * cream, brand) are kept as aliases so components do not all change at once.
 */

export const colors = {
  // Ink: plum-black
  ink: '#2a2230',
  graphite: '#2a2230', // alias of ink (dark fills, rare)
  inkDeep: '#1a141f',
  inkSecondary: '#5a4f5f',
  inkSoft: '#c9bfcc', // rare outlines (checkbox border)
  inkTertiary: '#73677a', // 4.5:1 on page and surface
  inkDisabled: '#b5abb8', // placeholders and disabled
  onInk: '#ffffff', // text on rose and ink fills
  onInkPure: '#ffffff',

  // Blush ladder: blush-white page, white cards, soft pink wells
  page: '#faf5f6',
  pageTop: '#fff9f7',
  surface: '#ffffff', // cards, sheets, tab bar
  canvas: '#ffffff', // card surface
  well: '#f2e6eb', // inputs, tracks, chips, tiles, grouped rows
  cream: '#f2e6eb', // alias of well
  surfaceSubtle: '#f2e6eb',
  surfaceTertiary: '#f6c9d6', // switch off track (blush)
  hairline: '#efe1e5',
  hairlineCool: '#efe1e5',

  // The one accent: berry rose
  rose: '#b03f6b',
  roseDeep: '#8e2f55',
  roseWash: '#fbe7ee',
  blush: '#f6c9d6', // decorative: ring tracks, glows
  brand: '#b03f6b',
  brandSoft: '#fbe7ee',
  brandWash: '#fbe7ee',
  brandDeep: '#8e2f55',
  sage: '#b03f6b', // legacy alias: progress and toggles now use rose
  sageDeep: '#8e2f55',
  sageWash: '#fbe7ee',
  // Companion voice: lilac
  lilac: '#6552b8',
  lilacWash: '#efebfa',
  lilacSoft: '#d9d0f2',
  assist: '#6552b8',
  assistWash: '#efebfa',
  // Warmth (decorative)
  peach: '#f4b8a0',
  peachWash: '#fff0e8',
  amber: '#9a5a2e',
  indigo: '#6552b8',
  indigoDeep: '#4b3d94',
  indigoSoft: '#efebfa',

  // Status (always paired with text or an icon)
  positive: '#2f6b58',
  positiveWash: '#e3efe9',
  negative: '#b3261e',
  negativeWash: '#fbe4e1',
  warning: '#9a5a2e',
  warningWash: '#fdebdd',
  info: '#6552b8',
  infoWash: '#efebfa',
  focus: '#b03f6b',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  /** Card inner padding (DESIGN.md: 20px). */
  card: 20,
} as const;

export const radii = {
  none: 0,
  hairline: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 16, // inputs, nested panels, icon tiles
  xl: 24, // cards and panels
  sheet: 32, // sheets and modals
  pill: 9999, // every action and tag
} as const;

/**
 * Inter, loaded in the root layout. Custom fonts carry their weight in the
 * family name, so a weight is always turned into a family with `fontFor`.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export function fontFor(weight: string | number | undefined): string {
  const w = Number(weight ?? 400);
  if (weight === 'bold' || w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.regular;
}

export const typography = {
  /** Greeting and page-level statement. */
  display: { fontSize: 30, lineHeight: 38, fontWeight: '600' as const, letterSpacing: -0.3 },
  /** Page and sheet titles. */
  title: { fontSize: 24, lineHeight: 30, fontWeight: '600' as const },
  /** Card titles. */
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const },
  /** Big numbers in rings and stats. */
  figure: { fontSize: 32, lineHeight: 36, fontWeight: '600' as const, letterSpacing: -0.5 },
  /** Section labels, set in capitals. */
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  small: { fontSize: 14, lineHeight: 21, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;

/** Minimum touch target (WCAG / §10 accessibility). */
export const TOUCH_TARGET = 44;
/** Height of primary and secondary pill buttons. */
export const BUTTON_HEIGHT = 48;

export type ColorName = keyof typeof colors;
export type TypographyVariant = keyof typeof typography;
