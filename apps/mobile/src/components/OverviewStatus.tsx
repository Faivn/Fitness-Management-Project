import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing } from '@/theme/tokens';
import { statusCopy, type OverviewStatus } from '@/lib/overviewStatus';
import { Button } from './Button';
import { Mascot, type MascotMood } from './Mascot';
import { Text } from './Text';

/** Soft organic blob behind the illustration (a 236 box, not a circle). */
const BLOB = 'M118 8c36-4 70 14 90 44 19 29 28 64 14 98-13 33-44 52-76 66-34 13-70 8-96-16C22 177 8 142 14 105 20 66 47 28 83 14c11-4 23-6 35-6z';

const LOOK: Record<OverviewStatus['kind'], { glow: string; ink: string; mood: MascotMood }> = {
  // Shades of pink and red only: red when something needs attention, rose when all is well.
  attention: { glow: colors.negativeGlow, ink: colors.alertInk, mood: 'oops' },
  upToDate: { glow: colors.blush, ink: colors.ink, mood: 'cheer' },
  unconfigured: { glow: colors.roseWash, ink: colors.ink, mood: 'welcome' },
};

/**
 * The Overview's focal point: a large, centred Mova illustration with a status-coloured
 * glow, a headline and supporting copy, left open on the page (no card). Only the
 * "needs attention" state has an action.
 */
export function OverviewStatusSection({ status, onCatchUp }: { status: OverviewStatus; onCatchUp: () => void }) {
  const look = LOOK[status.kind];
  const copy = statusCopy(status);
  return (
    <View style={styles.wrap} accessible={false}>
      <View style={styles.glow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={236} height={236} viewBox="0 0 236 236" style={StyleSheet.absoluteFill}>
          <Path d={BLOB} fill={look.glow} fillOpacity={0.85} />
        </Svg>
        <Mascot mood={look.mood} size={190} />
      </View>
      <View style={styles.copy} accessibilityLiveRegion="polite">
        <Text variant="title" align="center" accessibilityRole="header" style={{ color: look.ink, fontSize: 24, lineHeight: 30 }}>
          {copy.headline}
        </Text>
        <Text variant="small" align="center" color="inkSecondary" style={{ maxWidth: 320 }}>
          {copy.body}
        </Text>
      </View>
      {copy.action ? (
        <View style={{ alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'center' }}>
          <Button label={copy.action} variant="alert" onPress={onCatchUp} accessibilityHint="Opens the workouts waiting for an update" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg },
  glow: { width: 236, height: 236, alignItems: 'center', justifyContent: 'center' },
  copy: { alignItems: 'center', gap: spacing.sm },
});
