import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';
import { RuneIcon } from './RuneIcon';
import { Text } from './Text';

/**
 * A large single-choice card. The whole surface is the tap target; the selected
 * state is a rose-wash fill, a rose ring and a check (never colour alone), and
 * keyboard focus shows its own ring. Use inside a `radiogroup` container; on web the
 * arrow keys move to, focus and select the neighbouring card, as a radio group should.
 */

interface KeyEvent {
  key?: string;
  currentTarget: unknown;
  preventDefault?: () => void;
}

function moveWithArrows(e: KeyEvent) {
  const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
  const el = e.currentTarget as { parentElement?: { querySelectorAll: (q: string) => ArrayLike<{ focus: () => void; click: () => void }> } | null } | null;
  if (!step || !el?.parentElement) return;
  const radios = Array.from(el.parentElement.querySelectorAll('[role="radio"]'));
  const at = radios.indexOf(el as never);
  if (at < 0 || radios.length < 2) return;
  e.preventDefault?.();
  const next = radios[(at + step + radios.length) % radios.length]!;
  next.focus();
  next.click();
}

export function ChoiceCard({ title, hint, selected, onPress }: { title: string; hint?: string; selected: boolean; onPress: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={hint ? `${title}. ${hint}` : title}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...({ onKeyDown: moveWithArrows } as object)}
      style={({ pressed }) => [styles.card, selected && styles.selected, focused && styles.focused, pressed && { opacity: 0.9 }]}
    >
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: '600' }}>{title}</Text>
        {hint ? (
          <Text variant="small" color="inkSecondary">
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={[styles.mark, selected && styles.markOn]}>{selected ? <RuneIcon name="check" size={16} color="onInk" /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    minHeight: 88,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: { backgroundColor: colors.roseWash, borderColor: colors.rose },
  focused: { boxShadow: '0 0 0 4px rgba(176, 63, 107, 0.28)' } as object,
  mark: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center' },
  markOn: { backgroundColor: colors.rose, borderColor: colors.rose },
});
