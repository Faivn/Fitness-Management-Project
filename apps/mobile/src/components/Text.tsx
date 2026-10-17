import { StyleSheet, Text as RNText, type TextProps } from 'react-native';
import { colors, fontFor, typography, type ColorName, type TypographyVariant } from '@/theme/tokens';

interface Props extends TextProps {
  variant?: TypographyVariant;
  color?: ColorName;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', color = 'ink', align, style, ...rest }: Props) {
  const role = variant === 'display' || variant === 'title' || variant === 'heading' || variant === 'eyebrow' ? 'header' : undefined;
  const merged = StyleSheet.flatten([typography[variant], { color: colors[color], textAlign: align }, style]) ?? {};
  // The weight picks the font file; the weight itself is cleared so nothing is faux-bolded.
  return <RNText accessibilityRole={role} {...rest} style={[merged, { fontFamily: fontFor(merged.fontWeight), fontWeight: 'normal' }]} />;
}
