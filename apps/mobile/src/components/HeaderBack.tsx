import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { spacing } from '@/theme/tokens';
import { RuneIcon } from './RuneIcon';

/** Back arrow for every sub-page header: returns to the previous page, or to the main page when there is none. */
export function HeaderBack() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      hitSlop={8}
      style={{ marginLeft: spacing.base, padding: spacing.xs }}
    >
      <RuneIcon name="chevron-left" size={24} />
    </Pressable>
  );
}
