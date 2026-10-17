import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '@/theme/tokens';

/**
 * Blush page background: a faint fade from page-top to page with a soft lilac glow
 * at the top right and a peach glow at the bottom left (DESIGN.md).
 */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="none">
<defs>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${colors.pageTop}"/>
<stop offset="0.5" stop-color="${colors.page}"/>
<stop offset="1" stop-color="${colors.page}"/>
</linearGradient>
<radialGradient id="lilac" cx="0.95" cy="0.02" r="0.7" fx="0.95" fy="0.02">
<stop offset="0" stop-color="${colors.lilacSoft}" stop-opacity="0.55"/>
<stop offset="1" stop-color="${colors.lilacSoft}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="peach" cx="0.05" cy="0.98" r="0.7" fx="0.05" fy="0.98">
<stop offset="0" stop-color="${colors.peach}" stop-opacity="0.28"/>
<stop offset="1" stop-color="${colors.peach}" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="100%" height="100%" fill="url(#fade)"/>
<rect width="100%" height="100%" fill="url(#lilac)"/>
<rect width="100%" height="100%" fill="url(#peach)"/>
</svg>`;

export function Backdrop() {
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: colors.page }]}>
      <SvgXml xml={SVG} width="100%" height="100%" />
    </View>
  );
}
