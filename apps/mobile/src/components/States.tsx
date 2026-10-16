import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';
import { Button } from './Button';
import { Mascot, type MascotMood } from './Mascot';
import { Text } from './Text';

/** Explicit loading / empty / error states (spec §4.2, §8.3). */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.ink} />
      <Text variant="small" color="inkTertiary">
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  mood = 'thinking',
  action,
}: {
  title: string;
  body?: string;
  mood?: MascotMood;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.center}>
      <Mascot mood={mood} size={96} />
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="small" color="inkSecondary" align="center">
          {body}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[styles.banner, styles.error]} accessibilityRole="alert">
      <Text variant="label" color="negative">
        Something went wrong
      </Text>
      <Text variant="small" color="inkSecondary">
        {message}
      </Text>
      {onRetry ? <Button label="Try again" variant="secondary" size="sm" onPress={onRetry} /> : null}
    </View>
  );
}

type BannerTone = 'info' | 'warning' | 'success' | 'error';
const toneStyles: Record<BannerTone, { bg: string; fg: keyof typeof colors; label: string }> = {
  info: { bg: colors.infoWash, fg: 'info', label: 'Note' },
  warning: { bg: colors.warningWash, fg: 'warning', label: 'Check this' },
  success: { bg: colors.positiveWash, fg: 'positive', label: 'Saved' },
  error: { bg: colors.negativeWash, fg: 'negative', label: 'Error' },
};

export function Banner({ tone = 'info', title, children }: { tone?: BannerTone; title?: string; children: React.ReactNode }) {
  const t = toneStyles[tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: t.bg }]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'success' || tone === 'error' ? 'polite' : undefined}
    >
      <Text variant="label" color={t.fg}>
        {title ?? t.label}
      </Text>
      {typeof children === 'string' ? (
        <Text variant="small" color="inkSecondary">
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  banner: { borderRadius: radii.md, padding: spacing.base, gap: spacing.xs },
  error: { backgroundColor: colors.negativeWash },
});
