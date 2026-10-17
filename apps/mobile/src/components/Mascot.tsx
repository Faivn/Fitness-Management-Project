import { useEffect, useId, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Platform, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { MASCOT_SVG } from './mascotData.generated';

/**
 * The Mova bubble mascot. The editable source of truth is the SVG set in
 * assets/illustrations/mova (recoloured to the warm sandstone/amber palette);
 * `npm run mascot:generate` embeds it so it renders as a crisp vector everywhere.
 */
export type MascotMood = keyof typeof MASCOT_SVG;

/** The thought mark ("?") that only the thinking mood carries. */
const THOUGHT_MARK = /<circle cx="380" cy="145"[^>]*\/><text[^>]*>\?<\/text>/;

/** Subtle float animation; disabled when the user prefers reduced motion. */
export function Mascot({
  mood = 'welcome',
  size = 120,
  animated = true,
  plain = false,
}: {
  mood?: MascotMood;
  size?: number;
  animated?: boolean;
  /** Drop the thought mark, for places that need the same face every time (the nav button). */
  plain?: boolean;
}) {
  const y = useRef(new Animated.Value(0)).current;
  // Gradient ids must be unique per instance: with several mascots on a page (or one inside a
  // hidden tab), duplicate ids make the visible mascot's gradients resolve to a hidden element and drop out.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const xml = useMemo(() => (plain ? MASCOT_SVG[mood].replace(THOUGHT_MARK, '') : MASCOT_SVG[mood]).replace(/id="(\w+)"/g, `id="$1${uid}"`).replace(/url\(#(\w+)\)/g, `url(#$1${uid})`), [uid, mood, plain]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce || !animated) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(y, { toValue: -4, duration: 1600, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(y, { toValue: 0, duration: 1600, useNativeDriver: Platform.OS !== 'web' }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [animated, y]);

  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ transform: [{ translateY: y }] }}>
        <SvgXml xml={xml} width={size} height={size} />
      </Animated.View>
    </View>
  );
}
