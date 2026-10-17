import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Backdrop } from '@/components/Backdrop';
import { HeaderBack } from '@/components/HeaderBack';
import { ApiError } from '@/lib/api';
import { OnboardingProvider } from '@/lib/onboarding';
import { useFonts } from 'expo-font';
import { colors, fonts } from '@/theme/tokens';

/** Navigation's own scene background would hide the page gradient, so it is made transparent. */
const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };

/** Pages shown as bottom sheets over the previous page (swipe down to close). */
const SHEETS = ['companion', 'settings', 'history', 'schedule', 'routine/edit', 'routine/quick', 'catchup', 'shopping', 'records', 'exercise', 'session/[id]/index'] as const;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular: require('../../assets/fonts/Inter-Regular.ttf'),
    Inter_500Medium: require('../../assets/fonts/Inter-Medium.ttf'),
    Inter_600SemiBold: require('../../assets/fonts/Inter-SemiBold.ttf'),
  });
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
          },
          // Mutations are never retried automatically; the user retries with the same idempotency key.
          mutations: { retry: false },
        },
      }),
  );

  // On the web the page draws straight away in the system font and swaps to Inter when it arrives, so the
  // font download never blocks the first screen. On phones the font is bundled, so waiting is instant.
  if (Platform.OS !== 'web' && !fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <OnboardingProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1 }}>
        <Backdrop />
        <ThemeProvider value={navTheme}>
        <Stack
            screenOptions={{
              headerTintColor: colors.ink,
              headerStyle: { backgroundColor: 'transparent' },
              headerShadowVisible: false,
              headerTitleAlign: 'left',
              headerTitleStyle: { fontSize: 20, fontFamily: fonts.semibold, color: colors.ink },
              contentStyle: { backgroundColor: 'transparent' },
              headerBackVisible: false,
              headerLeft: () => <HeaderBack />,
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {SHEETS.map((name) => (
              <Stack.Screen key={name} name={name} options={{ presentation: 'transparentModal', headerShown: false, animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} />
            ))}
            <Stack.Screen name="session/[id]/reschedule" options={{ title: 'Move session', presentation: 'modal', contentStyle: { backgroundColor: colors.page }, headerStyle: { backgroundColor: colors.page } }} />
          </Stack>
        </ThemeProvider>
        </View>
        </OnboardingProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
