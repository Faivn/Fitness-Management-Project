import { Pressable, RefreshControl, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '@/theme/tokens';
import { Text } from './Text';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  footer?: React.ReactNode;
}

/** Page container: safe area, page background, consistent gutters. */
export function Screen({ children, scroll = true, refreshing, onRefresh, edges = ['left', 'right'], footer }: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.scroll, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      {content}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Card({ style, children, tone = 'canvas', ...rest }: ViewProps & { tone?: 'canvas' | 'subtle' | 'brand' }) {
  const bg = tone === 'subtle' ? colors.surfaceSubtle : tone === 'brand' ? colors.brandWash : colors.canvas;
  return (
    <View style={[styles.card, { backgroundColor: bg }, style]} {...rest}>
      {children}
    </View>
  );
}

export function PressableCard({
  onPress,
  accessibilityLabel,
  children,
  tone,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  tone?: 'canvas' | 'subtle' | 'brand';
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
      {({ pressed }) => (
        <Card tone={tone} style={{ opacity: pressed ? 0.85 : 1 }}>
          {children}
        </Card>
      )}
    </Pressable>
  );
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text variant="heading">{title}</Text>
        {action}
      </View>
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
}

export function Row({ style, ...rest }: ViewProps) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, style]} {...rest} />;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginVertical: spacing.sm }} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  scroll: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing['2xl'] },
  footer: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    backgroundColor: colors.canvas,
    gap: spacing.sm,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.base,
    gap: spacing.sm,
  },
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
