import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme/tokens';
import { Mascot } from './Mascot';
import { Text } from './Text';

/**
 * Motion primitives for the AI companion. Patterns are adapted from the beUI
 * agent components (message pop-up on arrival, staggered "live" dots) but
 * re-implemented on React Native's Animated API: beUI itself is React DOM +
 * Tailwind + `motion/react`, which does not run on React Native.
 *
 * Every primitive renders statically when the user prefers reduced motion.
 */
const native = Platform.OS !== 'web';

export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => live && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** Fades and lifts its content in once, on mount. `enabled={false}` renders it in place. */
export function Appear({
  children,
  enabled = true,
  variant = 'message',
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  enabled?: boolean;
  variant?: 'message' | 'card';
  delay?: number;
  style?: ViewStyle;
}) {
  const reduce = useReducedMotion();
  const animate = enabled && !reduce;
  const t = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    Animated.timing(t, { toValue: 1, duration: variant === 'card' ? 260 : 200, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [animate, delay, t, variant]);
  const lift = variant === 'card' ? 12 : 8;
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [lift, 0] }) },
            ...(variant === 'card' ? [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }] : []),
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function Dot({ index, animated }: { index: number; animated: boolean }) {
  const o = useRef(new Animated.Value(animated ? 0.3 : 0.6)).current;
  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 140),
        Animated.timing(o, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(o, { toValue: 0.3, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.delay((2 - index) * 140),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, index, o]);
  return <Animated.View style={[styles.dot, { opacity: o }]} />;
}

/**
 * "Mova is thinking" status: mascot, three softly pulsing dots and text.
 * The text carries the meaning (and the live-region announcement), so the
 * dots are purely decorative and static under reduced motion.
 */
export function ThinkingIndicator({ label = 'Thinking' }: { label?: string }) {
  const reduce = useReducedMotion();
  return (
    <View style={styles.thinking} accessible accessibilityRole="progressbar" accessibilityLabel={`${label}…`} accessibilityLiveRegion="polite">
      <Mascot mood="thinking" size={40} animated={false} />
      <Text variant="small" color="inkTertiary">
        {label}
      </Text>
      <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {[0, 1, 2].map((i) => (
          <Dot key={i} index={i} animated={!reduce} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dots: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.inkTertiary },
});
