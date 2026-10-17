import { useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors, type ColorName } from '@/theme/tokens';
import { RUNE_ICONS, type RuneIconName as GeneratedIconName } from './runeIconData.generated';

/** Icons Rune does not ship. Same 24px grid and 2px round stroke, tinted through currentColor. */
const EXTRA_ICONS = {
  dumbbell: { id: 'custom-dumbbell', viewBox: '0 0 24 24', markup: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></g>' },
  footprints: { id: 'custom-footprints', viewBox: '0 0 24 24', markup: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.5c-1.6 0-2.8 1.8-2.8 4.4S6.4 13 8 13s2.8-2.5 2.8-5.1S9.6 3.5 8 3.5zM6.8 16.5h2.4"/><path d="M16 9c-1.6 0-2.8 1.8-2.8 4.4S14.4 18.5 16 18.5s2.8-2.5 2.8-5.1S17.6 9 16 9zM14.8 21.5h2.4"/></g>' },
  utensils: { id: 'custom-utensils', viewBox: '0 0 24 24', markup: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v5a3 3 0 0 0 6 0V3M8 11v10"/><path d="M18 21V3c-2.5 1.4-3.5 4.4-3.5 8H18"/></g>' },
  droplet: { id: 'custom-droplet', viewBox: '0 0 24 24', markup: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3z"/></g>' },
  'chat-plus': {
    id: 'custom-chat-plus',
    viewBox: '0 0 24 24',
    markup:
      '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v6M9 10h6"/></g>',
  },
} as const;

const ICONS = { ...RUNE_ICONS, ...EXTRA_ICONS };
export type RuneIconName = GeneratedIconName | keyof typeof EXTRA_ICONS;

/**
 * UI icon from RuneIcons (https://www.runeicons.com, Apache-2.0), rendered as
 * SVG through react-native-svg so it works on iOS, Android and web. Icons are
 * decorative: put the accessible label on the control that contains them.
 */
export function RuneIcon({ name, size = 22, color = 'ink', detail = 'ink' }: { name: RuneIconName; size?: number; color?: ColorName; detail?: ColorName }) {
  const xml = useMemo(() => {
    const icon = ICONS[name];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" width="${size}" height="${size}">${icon.markup
      .replace(/currentColor/g, colors[color])
      // Filled variants are two-tone with fixed colours: body fill and inner detail lines.
      .replace(/#DDDDDD/gi, colors[color])
      .replace(/#1C1F21/gi, colors[detail])}</svg>`;
  }, [name, size, color, detail]);
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}

