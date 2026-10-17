import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme/tokens';
import { RuneIcon } from './RuneIcon';

const MIN = 24;
const MAX = 120;

/**
 * Compact message composer: one rounded container with the input and a small round
 * button on the right. With no text the button is a grey star that opens the options
 * picker; once something is typed it becomes a send arrow. On the web, Enter sends
 * and Shift+Enter adds a line.
 */
export function Composer({
  value,
  onChangeText,
  onSend,
  onOptions,
  sending,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onOptions: () => void;
  sending?: boolean;
  placeholder: string;
}) {
  const [height, setHeight] = useState(MIN);
  const hasText = value.trim().length > 0;
  return (
    <View style={styles.box}>
      <TextInput
        accessibilityLabel="Message"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkDisabled}
        multiline
        onContentSizeChange={(e) => setHeight(Math.min(MAX, Math.max(MIN, Math.ceil(e.nativeEvent.contentSize.height))))}
        onKeyPress={(e) => {
          const ev = e as unknown as { nativeEvent: { key: string; shiftKey?: boolean }; preventDefault?: () => void };
          if (Platform.OS === 'web' && ev.nativeEvent.key === 'Enter' && !ev.nativeEvent.shiftKey) {
            ev.preventDefault?.();
            if (hasText && !sending) onSend();
          }
        }}
        style={[styles.input, { height }]}
      />
      {hasText || sending ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !!sending, busy: !!sending }}
          disabled={sending}
          onPress={onSend}
          style={({ pressed }) => [styles.round, styles.send, pressed && { opacity: 0.8 }]}
        >
          {sending ? <ActivityIndicator size="small" color={colors.onInk} /> : <RuneIcon name="arrow-up" size={20} color="onInk" />}
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose what to ask"
          onPress={onOptions}
          style={({ pressed }) => [styles.round, styles.star, pressed && { opacity: 0.8 }]}
        >
          <RuneIcon name="sparkles" size={20} color="lilac" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingLeft: spacing.base,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.onInkPure,
  },
  input: { flex: 1, color: colors.ink, fontSize: 16, lineHeight: 24, fontFamily: fonts.regular, paddingVertical: 0, marginVertical: 7, outlineStyle: 'none' } as object,
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  send: { backgroundColor: colors.rose },
  star: { backgroundColor: colors.lilacWash },
});
