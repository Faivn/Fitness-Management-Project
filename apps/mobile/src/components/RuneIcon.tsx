import { useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors, type ColorName } from '@/theme/tokens';
import { RUNE_ICONS, type RuneIconName } from './runeIconData.generated';

/**
 * UI icon from RuneIcons (https://www.runeicons.com, Apache-2.0), rendered as
 * SVG through react-native-svg so it works on iOS, Android and web. Icons are
 * decorative: put the accessible label on the control that contains them.
 */
export function RuneIcon({ name, size = 22, color = 'ink' }: { name: RuneIconName; size?: number; color?: ColorName }) {
  const xml = useMemo(() => {
    const icon = RUNE_ICONS[name];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" width="${size}" height="${size}">${icon.markup.replace(/currentColor/g, colors[color])}</svg>`;
  }, [name, size, color]);
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}

export type { RuneIconName };
