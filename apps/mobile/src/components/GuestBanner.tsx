import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { GUEST_RETENTION_DAYS, sampleMode } from '@/lib/config';
import { colors, spacing } from '@/theme/tokens';
import { Text } from './Text';

/** Reminds guests that their workspace is temporary; taps through to Settings where it can be erased. */
export function GuestBanner() {
  const { isGuest } = useAuth();
  const insets = useSafeAreaInsets();
  if (sampleMode || !isGuest) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Demo workspace. Saved in this browser for ${GUEST_RETENTION_DAYS} days. Open settings to erase it.`}
      onPress={() => router.push('/settings')}
      style={{ backgroundColor: colors.brandWash, paddingTop: insets.top + spacing.xs, paddingBottom: spacing.xs, paddingHorizontal: spacing.base }}
    >
      <Text variant="caption" color="brandDeep" align="center">
        {`Demo workspace · private to this browser · deleted after ${GUEST_RETENTION_DAYS} days`}
      </Text>
    </Pressable>
  );
}
