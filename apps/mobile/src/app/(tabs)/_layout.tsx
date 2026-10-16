import { Redirect, router, Tabs } from 'expo-router';
import { Pressable, type ColorValue } from 'react-native';
import { useReminderSync } from '@/hooks/useReminderSync';
import { useAuth } from '@/lib/auth';
import { sampleMode } from '@/lib/config';
import { RuneIcon, type RuneIconName } from '@/components/RuneIcon';
import { colors } from '@/theme/tokens';

function tabIcon(name: RuneIconName) {
  // Active tab = ink colour (the label is also heavier); inactive = muted.
  return ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <RuneIcon name={name} size={size} color={color === colors.ink ? 'ink' : 'inkTertiary'} />
  );
}

function HeaderButtons() {
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={10} onPress={() => router.push('/settings')} style={{ marginRight: 16 }}>
        <RuneIcon name="settings" size={22} />
      </Pressable>
    </>
  );
}

/** Primary navigation (spec §4.1). The AI companion is reachable from every tab header. */
function ReminderSync() {
  useReminderSync();
  return null;
}

function MaybeReminderSync() {
  return sampleMode ? null : <ReminderSync />;
}

export default function TabsLayout() {
  const { session, loading } = useAuth();
  if (!sampleMode && !loading && !session) return <Redirect href="/sign-in" />;
  return (
    <>
    <MaybeReminderSync />
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarStyle: { backgroundColor: colors.canvas, borderTopColor: colors.hairline },
        headerStyle: { backgroundColor: colors.page },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        tabBarLabelStyle: { fontWeight: '600' },
        headerRight: () => <HeaderButtons />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: tabIcon('overview') }} />
      <Tabs.Screen name="workouts" options={{ title: 'Workouts', tabBarIcon: tabIcon('workouts') }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: tabIcon('schedule') }} />
      <Tabs.Screen name="meals" options={{ title: 'Meal plan', tabBarIcon: tabIcon('meals') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: tabIcon('history') }} />
    </Tabs>
    </>
  );
}
