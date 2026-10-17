import { router, Tabs, useIsFocused, usePathname } from 'expo-router';
import { Pressable, Text, View, type ColorValue } from 'react-native';
import { FloatingNav, NAV_HEIGHT, NAV_LIFT } from '@/components/FloatingNav';
import { AvatarCharacter } from '@/components/AvatarCharacter';
import { HeaderBack } from '@/components/HeaderBack';
import { useAvatar } from '@/lib/avatar';
import { NavInsetContext } from '@/components/Layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RuneIcon, type RuneIconName } from '@/components/RuneIcon';
import { useReminderSync } from '@/hooks/useReminderSync';
import { colors, fonts, radii, spacing, TOUCH_TARGET } from '@/theme/tokens';


/** Header title that only draws on the focused tab (transparent headers of other tabs would otherwise overlap it). */
function TabTitle({ children }: { children?: string }) {
  const focused = useIsFocused();
  if (!focused) return null;
  return <Text style={{ fontSize: 24, fontFamily: fonts.semibold, color: colors.ink }}>{children}</Text>;
}

/** Round, equal-size icon containers (History, Settings, New routine, Schedule), per DESIGN.md's full-round action grammar. */
function HeaderIcon({ icon, label, href }: { icon: RuneIconName; label: string; href: '/history' | '/settings' | '/routine/edit' | '/schedule' }) {
  const active = usePathname() === href;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={() => router.push(href)}
      style={({ pressed }) => ({
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        borderRadius: TOUCH_TARGET / 2,
        backgroundColor: active ? colors.rose : 'rgba(255, 255, 255, 0.72)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <RuneIcon name={icon} size={24} color={active ? 'onInk' : 'ink'} />
    </Pressable>
  );
}

/** Profile avatar on the Overview header: the visitor's random character. Display only. */
function Avatar() {
  const focused = useIsFocused();
  const avatar = useAvatar();
  if (!focused) return null;
  return (
    <View
      accessible
      accessibilityLabel="Your avatar"
      style={{
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        borderRadius: TOUCH_TARGET / 2,
        marginLeft: spacing.base,
        backgroundColor: colors.roseWash,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {avatar ? <AvatarCharacter avatar={avatar} size={TOUCH_TARGET} /> : null}
    </View>
  );
}

function WorkoutButtons() {
  const focused = useIsFocused();
  if (!focused) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginRight: spacing.base }}>
      <HeaderIcon icon="plus" label="New routine" href="/routine/edit" />
      <HeaderIcon icon="schedule" label="Schedule" href="/schedule" />
    </View>
  );
}

function HeaderButtons() {
  // Transparent headers of other tabs would otherwise overlap this one.
  const focused = useIsFocused();
  if (!focused) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginRight: spacing.base }}>
      <HeaderIcon icon="history" label="History" href="/history" />
      <HeaderIcon icon="settings" label="Settings" href="/settings" />
    </View>
  );
}

function ReminderSync() {
  useReminderSync();
  return null;
}

/**
 * Primary navigation: Overview, Workouts, Meal plan. History is reached from
 * the header; Schedule from Workouts. Both stay routes of this navigator but
 * are not tabs.
 */
export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();
  const navInset = NAV_HEIGHT + Math.max(bottom, 8) + NAV_LIFT;
  return (
    <NavInsetContext.Provider value={navInset}>
      <ReminderSync />
      <Tabs
        tabBar={(props) => <FloatingNav {...props} />}
        screenOptions={{
          sceneStyle: { backgroundColor: 'transparent' },
          headerStyle: { backgroundColor: 'transparent', height: 64 },
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          headerTitle: (props) => <TabTitle>{props.children}</TabTitle>,
          headerTitleStyle: { fontSize: 24, fontFamily: fonts.semibold, color: colors.ink },
          headerRight: () => null,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Overview', headerTitle: '', headerLeft: () => <Avatar />, headerRight: () => <HeaderButtons /> }} />
        <Tabs.Screen name="workouts" options={{ title: 'Workouts', headerRight: () => <WorkoutButtons /> }} />
        <Tabs.Screen name="meals" options={{ title: 'Meal plan' }} />
      </Tabs>
    </NavInsetContext.Provider>
  );
}
