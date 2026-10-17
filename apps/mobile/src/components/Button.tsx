import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { BUTTON_HEIGHT, colors, radii, spacing } from '@/theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger' | 'alert';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'sm';
  icon?: React.ReactNode;
}

// DESIGN.md: ink pill for the main action; well-filled pill (no outline) for the rest.
const palette: Record<Variant, { bg: string; fg: keyof typeof colors; border?: string }> = {
  primary: { bg: colors.rose, fg: 'onInk' },
  brand: { bg: colors.rose, fg: 'onInk' },
  secondary: { bg: colors.well, fg: 'ink' },
  ghost: { bg: 'transparent', fg: 'roseDeep' },
  alert: { bg: colors.alert, fg: 'onInk' },
  danger: { bg: colors.negativeWash, fg: 'negative' },
};

/** Pill button (DESIGN.md button-primary / button-secondary / button-text-link). */
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
          <Text variant={size === 'sm' ? 'label' : 'bodyStrong'} color={p.fg}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: BUTTON_HEIGHT,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { minHeight: 40, paddingHorizontal: spacing.base },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
