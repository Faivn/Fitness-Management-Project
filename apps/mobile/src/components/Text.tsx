import { Text as RNText, type TextProps } from 'react-native';
import { colors, typography, type ColorName, type TypographyVariant } from '@/theme/tokens';

interface Props extends TextProps {
  variant?: TypographyVariant;
  color?: ColorName;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', color = 'ink', align, style, ...rest }: Props) {
  const role = variant === 'display' || variant === 'title' || variant === 'heading' ? 'header' : undefined;
  return (
    <RNText
      accessibilityRole={role}
      {...rest}
      style={[typography[variant], { color: colors[color], textAlign: align }, style]}
    />
  );
}
