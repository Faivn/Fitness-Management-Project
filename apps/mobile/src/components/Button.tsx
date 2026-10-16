import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { colors, radii, spacing, TOUCH_TARGET } from '@/theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'sm';
  icon?: React.ReactNode;
}

const palette: Record<Variant, { bg: string; fg: keyof typeof colors; border?: string }> = {
  primary: { bg: colors.ink, fg: 'onInk' },
  brand: { bg: colors.brand, fg: 'ink' },
  secondary: { bg: colors.canvas, fg: 'ink', border: colors.ink },
  ghost: { bg: 'transparent', fg: 'ink' },
  danger: { bg: colors.canvas, fg: 'negative', border: colors.negative },
};

/** Pill button (DESIGN.md button-primary / button-brand / button-secondary). */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  fullWidth,
  size = 'md',
  icon,
  accessibilityLabel,
  ...rest
}: Props) {
  const p = palette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.small,
        {
          backgroundColor: p.bg,
          borderColor: p.border ?? 'transparent',
          opacity: isDisabled ? 0.45 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors[p.fg]} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant="label" color={p.fg}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { minHeight: 36, paddingHorizontal: spacing.base },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
