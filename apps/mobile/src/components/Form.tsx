import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, TextInput, useWindowDimensions, View, type TextInputProps } from 'react-native';
import { colors, fonts, radii, spacing, TOUCH_TARGET } from '@/theme/tokens';
import { useFieldFill } from './fieldTone';
import { RuneIcon } from './RuneIcon';
import { Text } from './Text';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  helper?: string;
  /** Regular-weight label instead of bold. */
  lightLabel?: boolean;
  /** Keep the label for assistive technology only (the section already names the field). */
  hideLabel?: boolean;
}

/** Labelled text input (DESIGN.md text-input; 2px ink border on focus). */
export function TextField({ label, error, helper, lightLabel, hideLabel, style, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const fill = useFieldFill();
  return (
    <View style={styles.field}>
      {hideLabel ? null : (
        <Text variant="label" style={{ fontWeight: lightLabel ? '400' : '500' }}>
          {label}
        </Text>
      )}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={helper}
        placeholderTextColor={colors.inkDisabled}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          { backgroundColor: fill },
          rest.multiline && styles.multiline,
          error ? { borderColor: colors.negative, borderWidth: 1 } : null,
          { outlineStyle: 'none' } as object,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color="negative" accessibilityRole="alert">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" color="inkTertiary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Single-choice dropdown: a field-style button showing the current value; the options
 * open beneath it as a short list and close on choosing one.
 */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const button = useRef<React.ComponentRef<typeof Pressable>>(null);
  const win = useWindowDimensions();
  const fill = useFieldFill();
  const current = options.find((o) => o.value === value)?.label ?? '';
  const listHeight = Math.min(options.length * TOUCH_TARGET + 2, win.height * 0.5);
  // Open below the field, or above it when there is no room below.
  const below = anchor.y + anchor.height + 4 + listHeight <= win.height - 12;
  const top = below ? anchor.y + anchor.height + 4 : Math.max(12, anchor.y - listHeight - 4);

  function toggle() {
    if (open) return setOpen(false);
    // Measured in window coordinates so the list can be drawn in a layer above every other element.
    button.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }

  return (
    <View style={styles.field}>
      <Text variant="label" style={{ fontWeight: '500' }}>
        {label}
      </Text>
      <Pressable
        ref={button}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
        accessibilityHint="Opens the list of choices"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={[styles.input, styles.select, { backgroundColor: fill }, error ? { borderColor: colors.negative, borderWidth: 1 } : null]}
      >
        <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
          {current}
        </Text>
        <RuneIcon name={open ? 'chevron-up' : 'chevron-down'} size={20} color="inkTertiary" />
      </Pressable>
      {/* The list lives in a transparent Modal: a separate top layer, so nothing can cover or clip it. */}
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close list" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <View
            accessibilityRole="menu"
            style={[styles.options, { position: 'absolute', left: anchor.x, top, width: anchor.width, maxHeight: listHeight }]}
            // Taps inside the list must not reach the closing backdrop.
            onStartShouldSetResponder={() => true}
          >
            {options.map((o) => {
              const selected = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.option, selected && { backgroundColor: colors.roseWash }, pressed && { opacity: 0.8 }]}
                >
                  <Text variant="body" style={{ flex: 1, fontWeight: selected ? '600' : '400' }}>
                    {o.label}
                  </Text>
                  {selected ? <RuneIcon name="check" size={16} color="rose" /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
      {error ? (
        <Text variant="caption" color="negative" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Numeric input that keeps "unknown" as empty — never coerces blanks to 0. */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  allowDecimal = true,
  error,
  helper,
  placeholder = 'Not recorded',
  lightLabel,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  allowDecimal?: boolean;
  error?: string;
  helper?: string;
  placeholder?: string;
  lightLabel?: boolean;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  return (
    <TextField
      lightLabel={lightLabel}
      label={unit ? `${label} (${unit})` : label}
      value={text}
      placeholder={placeholder}
      keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
      error={error}
      helper={helper}
      onChangeText={(t) => {
        const cleaned = t.replace(',', '.');
        setText(cleaned);
        if (cleaned.trim() === '') return onChange(undefined);
        const n = Number(cleaned);
        onChange(Number.isFinite(n) ? n : undefined);
      }}
    />
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  inline,
  equal,
}: {
  label?: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  /** Label on the left and a fixed-width, equal-segment control on the right, so stacked rows align. */
  inline?: boolean;
  /** Segments share the full width equally. */
  equal?: boolean;
}) {
  const fill = useFieldFill();
  return (
    <View style={inline ? styles.inlineField : styles.field}>
      {label ? (
        <Text variant="label" style={[{ fontWeight: '500' }, inline ? { flex: 1 } : null]}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.segmented, inline && styles.segmentedInline, equal && styles.segmentedEqual]} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={[styles.segment, { backgroundColor: fill }, (inline || equal) && styles.segmentInline, selected && styles.segmentSelected]}
            >
              <Text variant="label" color={selected ? 'onInk' : 'ink'}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="small" color="inkTertiary">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.rose, false: colors.blush }}
        thumbColor={colors.onInkPure}
        // @ts-expect-error react-native-web prop
        activeThumbColor={colors.onInkPure}
      />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const fill = useFieldFill();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: fill }, selected && styles.chipSelected]}
    >
      <Text variant="label" color={selected ? 'onInk' : 'inkSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    minHeight: TOUCH_TARGET,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.well,
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  select: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  options: { elevation: 8, shadowColor: '#2a2230', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH_TARGET, paddingHorizontal: spacing.base },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  segment: {
    minHeight: 40,
    paddingHorizontal: spacing.base,
    borderRadius: radii.pill,
    backgroundColor: colors.well,
    justifyContent: 'center',
  },
  inlineField: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  segmentedInline: { width: 216, flexWrap: 'nowrap' },
  segmentedEqual: { flexWrap: 'nowrap' },
  segmentInline: { flex: 1, paddingHorizontal: 0, alignItems: 'center' },
  segmentSelected: { backgroundColor: colors.rose },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.cream,
    alignSelf: 'flex-start',
  },
  chipSelected: { backgroundColor: colors.rose },
});
