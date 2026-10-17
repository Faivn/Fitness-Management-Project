import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing, TOUCH_TARGET } from '@/theme/tokens';
import { FieldToneContext } from './fieldTone';
import { RuneIcon, type RuneIconName } from './RuneIcon';
import { Text } from './Text';

/** Round icon button. The label is required: icons alone are not accessible. */
export function IconButton({
  icon,
  label,
  onPress,
  variant = 'solid',
  disabled,
  size = TOUCH_TARGET,
}: {
  icon: RuneIconName;
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outline' | 'plain';
  disabled?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        variant === 'solid' && { backgroundColor: 'rgba(255, 255, 255, 0.72)' },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.inkSoft },
      ]}
    >
      <RuneIcon name={icon} size={20} />
    </Pressable>
  );
}

/**
 * A collapsible card: the whole header is the toggle, and its expanded state is
 * announced to assistive technology.
 */
export function ExpandableCard({
  title,
  summary,
  defaultExpanded = false,
  tone = 'canvas',
  titleSize,
  children,
}: {
  title: string;
  summary?: string;
  defaultExpanded?: boolean;
  tone?: 'canvas' | 'brand';
  /** Smaller title (px), for denser lists. */
  titleSize?: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <View style={[styles.expandable, { backgroundColor: tone === 'brand' ? colors.brandSoft : colors.canvas }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary ? `${title}, ${summary}` : title}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((e) => !e)}
        style={({ pressed }) => [styles.expandableHeader, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <Text variant="heading" style={titleSize ? { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.25) } : undefined}>
            {title}
          </Text>
          {summary ? (
            <Text variant="small" color={tone === 'brand' ? 'brandDeep' : 'inkTertiary'}>
              {summary}
            </Text>
          ) : null}
        </View>
        <RuneIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>
      {expanded ? (
        <View style={styles.expandableBody}>
          <FieldToneContext.Provider value="well">{children}</FieldToneContext.Provider>
        </View>
      ) : null}
    </View>
  );
}

/** Two or more equal-width underlined text tabs (not pills). */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: T; label: string }>;
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {tabs.map((t) => {
        const selected = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={t.label}
            onPress={() => onChange(t.key)}
            style={[styles.tab, { borderBottomColor: selected ? colors.rose : colors.hairline }]}
          >
            <Text variant="bodyStrong" color={selected ? 'ink' : 'inkTertiary'} align="center" numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** ‹  12 Oct – 18 Oct  ›  — circular arrows around a soft, white, outline-free pill. */
export function DateRangeHeader({ label, onPrevious, onNext, unit = 'week' }: { label: string; onPrevious: () => void; onNext: () => void; unit?: 'week' | 'month' }) {
  return (
    <View style={styles.dateRow}>
      <IconButton icon="chevron-left" label={`Previous ${unit}`} onPress={onPrevious} />
      <View style={styles.datePill} accessible accessibilityLabel={unit === 'week' ? `Week of ${label}` : label} accessibilityLiveRegion="polite">
        <Text variant="bodyStrong" align="center" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <IconButton icon="chevron-right" label={`Next ${unit}`} onPress={onNext} />
    </View>
  );
}

type TileKind = 'strength' | 'activity' | 'meal' | 'water' | 'fasting';
const TILE_ICON: Record<TileKind, RuneIconName> = {
  strength: 'dumbbell',
  activity: 'footprints',
  meal: 'utensils',
  water: 'droplet',
  fasting: 'clock',
};

/** Soft rounded square with a domain icon, same Rune family and 2px stroke as every other icon. */
export function IconTile({ kind, size = 44 }: { kind: TileKind; size?: number }) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.tile, { width: size, height: size }]}>
      <RuneIcon name={TILE_ICON[kind]} size={20} color="roseDeep" />
    </View>
  );
}

export const tileKindFor = (activityType: string): TileKind => (activityType === 'strength' ? 'strength' : 'activity');

/** Tappable row: tile, two text lines and a chevron. Used for sessions and meals. */
export function TileRow({
  kind,
  medium,
  title,
  subtitle,
  eyebrow,
  link,
  onPress,
  accessibilityLabel,
}: {
  kind?: TileKind;
  /** Medium instead of bold title. */
  medium?: boolean;
  title: string;
  subtitle?: string | null;
  eyebrow?: string;
  link?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const body = (
    <View style={styles.tileRow}>
      {kind ? <IconTile kind={kind} /> : null}
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text variant="caption" color="brandDeep">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant={medium ? 'body' : 'bodyStrong'} style={medium ? { fontWeight: '500' } : undefined}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color="inkTertiary">
            {subtitle}
          </Text>
        ) : null}
        {link ? (
          <Text variant="label" color="brandDeep">
            {link}
          </Text>
        ) : null}
      </View>
      {onPress ? <RuneIcon name="chevron-right" size={20} color="inkTertiary" /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {body}
    </Pressable>
  );
}

/** "+ Add water" style text action with a leading icon. */
export function TextAction({ label, icon, onPress }: { label: string; icon?: RuneIconName; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={styles.textAction}>
      {icon ? <RuneIcon name={icon} size={16} /> : null}
      <Text variant="bodyStrong">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radii.lg, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + spacing.sm },
  textAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: TOUCH_TARGET, alignSelf: 'flex-start' },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  expandable: { borderRadius: radii.xl, overflow: 'hidden' },
  expandableHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.card, minHeight: TOUCH_TARGET + spacing.base },
  expandableBody: { paddingHorizontal: spacing.card, paddingBottom: spacing.card, gap: spacing.md },
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, flexBasis: 0, minHeight: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  datePill: { flex: 1, minHeight: TOUCH_TARGET, borderRadius: radii.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.base },
});
