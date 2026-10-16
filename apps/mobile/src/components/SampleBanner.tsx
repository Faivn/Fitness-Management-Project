import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sampleMode } from '@/lib/config';
import { formatDate } from '@/lib/format';
import { SAMPLE_TODAY } from '@/sample/sampleApi';
import { colors, spacing } from '@/theme/tokens';
import { Text } from './Text';

/** Always visible in the preview so sample data can't be mistaken for real records. */
export function SampleBanner() {
  const insets = useSafeAreaInsets();
  if (!sampleMode) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: colors.warningWash, paddingTop: insets.top + spacing.xs, paddingBottom: spacing.xs, paddingHorizontal: spacing.base }}
    >
      <Text variant="caption" color="warning" align="center">
        {`PREVIEW · sample data as of ${formatDate(SAMPLE_TODAY, true)} · read-only, nothing is saved · AI not connected`}
      </Text>
    </View>
  );
}
