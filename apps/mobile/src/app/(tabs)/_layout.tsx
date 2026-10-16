import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, Tabs } from 'expo-router';
import { Pressable, type ColorValue } from 'react-native';
import { useReminderSync } from '@/hooks/useReminderSync';
import { useAuth } from '@/lib/auth';
import { sampleMode } from '@/lib/config';
import { colors } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName, active: IconName) {
  return ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? active : name} color={color as string} size={size} />
  );
}

function HeaderButtons() {
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Open the Mova companion" hitSlop={10} onPress={() => router.push('/companion')} style={{ marginRight: 16 }}>
        <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.ink} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={10} onPress={() => router.push('/settings')} style={{ marginRight: 16 }}>
        <Ionicons name="settings-outline" size={22} color={colors.ink} />
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
  // No session (e.g. browser data cleared): go back through the entry gate, which reopens a workspace.
  if (!sampleMode && !loading && !session) return <Redirect href="/" />;
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
        headerRight: () => <HeaderButtons />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: tabIcon('today-outline', 'today') }} />
      <Tabs.Screen name="workouts" options={{ title: 'Workouts', tabBarIcon: tabIcon('barbell-outline', 'barbell') }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: tabIcon('calendar-outline', 'calendar') }} />
      <Tabs.Screen name="meals" options={{ title: 'Meal plan', tabBarIcon: tabIcon('restaurant-outline', 'restaurant') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: tabIcon('time-outline', 'time') }} />
    </Tabs>
    </>
  );
}
