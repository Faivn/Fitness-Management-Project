import { useIsFocused } from 'expo-router';
import { createContext, useContext } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '@/theme/tokens';
import { FieldToneContext } from './fieldTone';
import { Text } from './Text';

/** Space the floating tab bar occupies at the bottom (0 outside the tabs); scroll content clears it. */
export const NavInsetContext = createContext(0);

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  footer?: React.ReactNode;
  /** Absolutely positioned content (e.g. a floating button) drawn above the scroll area. */
}

/** Page container: safe area, page background, consistent gutters. */
export function Screen({ children, scroll = true, refreshing, onRefresh, edges = ['left', 'right'], footer }: ScreenProps) {
  // Tab scenes are transparent (so the page gradient shows), so unfocused ones must hide themselves.
  const focused = useIsFocused();
  const navInset = useContext(NavInsetContext);
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scroll, navInset ? { paddingBottom: navInset + spacing.base } : null]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.scroll, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.safe, !focused && { display: 'none' }]}>
      <FieldToneContext.Provider value="white">{content}</FieldToneContext.Provider>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Card({ style, children, tone = 'canvas', ...rest }: ViewProps & { tone?: 'canvas' | 'subtle' | 'brand' | 'assist' }) {
  const bg = tone === 'subtle' ? colors.cream : tone === 'brand' ? colors.brandSoft : tone === 'assist' ? colors.lilacWash : colors.canvas;
  return (
    <View style={[styles.card, { backgroundColor: bg }, style]} {...rest}>
      <FieldToneContext.Provider value={tone === 'canvas' ? 'well' : 'white'}>{children}</FieldToneContext.Provider>
    </View>
  );
}

export function PressableCard({
  onPress,
  accessibilityLabel,
  accessibilityHint,
  children,
  tone,
  fill,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  children: React.ReactNode;
  tone?: 'canvas' | 'subtle' | 'brand';
  /** Share a row equally with a sibling card. */
  fill?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} onPress={onPress} style={fill ? { flex: 1, flexBasis: 0, minWidth: 0 } : undefined}>
      {({ pressed }) => (
        <Card tone={tone} style={[{ opacity: pressed ? 0.85 : 1 }, fill ? { flex: 1 } : null]}>
          {children}
        </Card>
      )}
    </Pressable>
  );
}

export function Section({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionHeader}>
          <Text variant="eyebrow" color="inkSecondary">
            {title}
          </Text>
          {action}
        </View>
      ) : null}
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

export function Row({ style, ...rest }: ViewProps) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, style]} {...rest} />;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginVertical: spacing.xs }} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // DESIGN.md §5: 12 between cards in a stack; 8 under the header; 16 gutters.
  scroll: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing['2xl'] },
  footer: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    gap: spacing.sm,
  },
  // No outline and no shadow: the card is one sandstone step deeper than the page.
  card: {
    borderRadius: radii.xl,
    padding: spacing.card,
    gap: spacing.sm,
  },
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
