import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Backdrop } from '@/components/Backdrop';
import { HeaderBack } from '@/components/HeaderBack';
import { ApiError } from '@/lib/api';
import { OnboardingProvider } from '@/lib/onboarding';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { colors, fonts } from '@/theme/tokens';

/** Navigation's own scene background would hide the page gradient, so it is made transparent. */
const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };

/** Pages shown as bottom sheets over the previous page (swipe down to close). */
const SHEETS = ['companion', 'settings', 'history', 'schedule', 'routine/edit', 'routine/quick'] as const;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
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

  // Wait for the font so text never flashes in a fallback face (an error falls back to the system font).
  if (!fontsLoaded && !fontError) return null;

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
