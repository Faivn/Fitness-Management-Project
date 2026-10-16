import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Platform, View } from 'react-native';

/**
 * The Mova bubble mascot (assets/illustrations/mova). Images are referenced
 * from the repository asset folder rather than copied, so there is one
 * source of truth for the illustrations.
 */
const sources = {
  welcome: require('../../../../assets/illustrations/mova/mova-bubble-welcome.png'),
  fitness: require('../../../../assets/illustrations/mova/mova-bubble-fitness.png'),
  planning: require('../../../../assets/illustrations/mova/mova-bubble-planning.png'),
  focus: require('../../../../assets/illustrations/mova/mova-bubble-focus.png'),
  hydration: require('../../../../assets/illustrations/mova/mova-bubble-hydration.png'),
  celebration: require('../../../../assets/illustrations/mova/mova-bubble-celebration.png'),
  rest: require('../../../../assets/illustrations/mova/mova-bubble-rest.png'),
  checklist: require('../../../../assets/illustrations/mova/mova-bubble-checklist.png'),
  thinking: require('../../../../assets/illustrations/mova/mova-bubble-thinking.png'),
  nutrition: require('../../../../assets/illustrations/mova/mova-bubble-nutrition.png'),
  calm: require('../../../../assets/illustrations/mova/mova-bubble-calm.png'),
  phone: require('../../../../assets/illustrations/mova/mova-bubble-phone.png'),
} as const;

export type MascotMood = keyof typeof sources;

/** Subtle float animation; disabled when the user prefers reduced motion. */
export function Mascot({ mood, size = 120, animated = true }: { mood: MascotMood; size?: number; animated?: boolean }) {
  const y = useRef(new Animated.Value(0)).current;

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
        <Image source={sources[mood]} style={{ width: size, height: size }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}
