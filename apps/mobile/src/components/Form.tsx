import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radii, spacing, TOUCH_TARGET } from '@/theme/tokens';
import { Text } from './Text';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  helper?: string;
}

/** Labelled text input (DESIGN.md text-input; 2px ink border on focus). */
export function TextField({ label, error, helper, style, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
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
          rest.multiline && styles.multiline,
          { borderColor: error ? colors.negative : focused ? colors.ink : colors.surfaceTertiary, borderWidth: focused ? 2 : 1 },
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
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  allowDecimal?: boolean;
  error?: string;
  helper?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  return (
    <TextField
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
}: {
  label?: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={[styles.segment, selected && styles.segmentSelected]}
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
        trackColor={{ true: colors.ink, false: colors.surfaceTertiary }}
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
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text variant="caption" color={selected ? 'onInk' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    minHeight: TOUCH_TARGET,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontSize: 16,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  segment: {
    minHeight: 36,
    paddingHorizontal: spacing.base,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSubtle,
    alignSelf: 'flex-start',
  },
  chipSelected: { backgroundColor: colors.ink },
});
