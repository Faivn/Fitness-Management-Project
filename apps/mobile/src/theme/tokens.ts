/**
 * Mova design tokens.
 *
 * Structure follows DESIGN.md (violet-tinted ink instead of pure black,
 * hairline-driven depth, 4px spacing base, 8/16/24/32/pill radius scale,
 * a single rationed brand "voltage"). The brand hue is Mova's own — taken
 * from the bubble mascot illustrations — rather than Klarna Pink, and the
 * proprietary Klarna typefaces are replaced by the platform font stack.
 * See docs/ARCHITECTURE_DECISIONS.md (ADR-009).
 */

export const colors = {
  // Brand (from assets/illustrations/mova gradients)
  brand: '#F477AD',
  brandSoft: '#FFD9EA',
  brandWash: '#FFF2F8',
  brandDeep: '#A8336A', // text-on-light use; 5.9:1 on white

  // Ink & surfaces
  ink: '#0B051D',
  inkSecondary: '#373544',
  inkTertiary: '#615F6D',
  inkDisabled: '#96959F',
  onInk: '#FFFFFF',

  canvas: '#FFFFFF',
  // Cards are borderless, so the page is a soft tint that white cards stand out against.
  page: '#F6F4F9',
  surfaceSubtle: '#EEECF2',
  surfaceTertiary: '#C4C3CA',
  hairline: '#E2E2E7',

  // Semantic (never the only signal — always paired with text/icon)
  positive: '#046234',
  positiveWash: '#E5F3EA',
  negative: '#931414',
  negativeWash: '#FBEAEA',
  warning: '#664600',
  warningWash: '#FFF4D6',
  info: '#3D2C8D',
  infoWash: '#EEEAFB',
  focus: '#7B57D8',
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
} as const;

export const radii = {
  hairline: 2,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 9999,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 24, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const }, // heading-sm
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '500' as const }, // label-md weight
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
} as const;

/** Minimum touch target (WCAG / §10 accessibility). */
export const TOUCH_TARGET = 44;

export type ColorName = keyof typeof colors;
export type TypographyVariant = keyof typeof typography;
