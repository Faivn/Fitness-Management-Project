import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '@/theme/tokens';
import { Mascot } from './Mascot';
import { RuneIcon, type RuneIconName } from './RuneIcon';
import { Text } from './Text';

/** Height of the nav bar and the round companion button beside it. */
export const NAV_HEIGHT = 64;
/** Space between the bar and the bottom safe area. */
export const NAV_LIFT = 12;

const ITEMS: Array<{ route: string; label: string; icon: RuneIconName }> = [
  { route: 'index', label: 'Overview', icon: 'overview-fill' },
  { route: 'workouts', label: 'Workouts', icon: 'workouts-fill' },
  { route: 'meals', label: 'Meal plan', icon: 'meals-fill' },
];

/** Space screens must leave at the bottom so content scrolls clear of the nav. */
export function useNavInset(): number {
  const { bottom } = useSafeAreaInsets();
  return NAV_HEIGHT + Math.max(bottom, 8) + NAV_LIFT;
}

/**
 * Floating navigation (DESIGN.md §6): a white pill with three destinations, and a
 * separate round companion button beside it. Each item stacks icon over label; the
 * active item sits in a soft rose capsule that wraps both.
 */
export function FloatingNav({ state, navigateToTab }: BottomTabBarProps) {
  const { bottom } = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);

  // A native keyboard covers the bar anyway; hide it so it never floats above the keys.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboard) return null;

  const active = state.routes[state.index]?.name;
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: Math.max(bottom, 8) + NAV_LIFT }]}>
      <View accessibilityRole="tablist" style={styles.bar}>
        {ITEMS.map((item) => {
          const route = state.routes.find((r) => r.name === item.route);
          if (!route) return null;
          const selected = active === item.route;
          return (
            <Pressable
              key={item.route}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={item.label}
              onPress={() => navigateToTab(route.key)}
              style={({ pressed }) => [styles.item, selected && styles.itemActive, pressed && !selected && { opacity: 0.7 }]}
            >
              <RuneIcon name={item.icon} size={24} color={selected ? 'rose' : 'inkTertiary'} detail={selected ? 'rose' : 'inkTertiary'} />
              <Text variant="caption" style={{ color: selected ? colors.roseDeep : colors.inkTertiary, fontSize: 11, lineHeight: 14 }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open the Mova companion"
        onPress={() => router.push('/companion')}
        style={({ pressed }) => [styles.companion, pressed && { opacity: 0.85 }]}
      >
        <Mascot mood="thinking" plain size={76} animated={false} />
      </Pressable>
    </View>
  );
}

const SHADOW = '0 8px 28px rgba(176, 63, 107, 0.14)';

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.base, right: spacing.base, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bar: {
    flex: 1,
    height: NAV_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    boxShadow: SHADOW,
    elevation: 8,
  } as object,
  item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radii.pill },
  itemActive: { backgroundColor: colors.roseWash },
  companion: {
    width: NAV_HEIGHT,
    height: NAV_HEIGHT,
    borderRadius: NAV_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    boxShadow: SHADOW,
    elevation: 8,
  } as object,
});
