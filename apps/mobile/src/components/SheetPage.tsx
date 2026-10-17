import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '@/theme/tokens';
import { IconButton } from './controls';
import { SheetContext } from './fieldTone';
import { Text } from './Text';

/** One size for every round control in a sheet header (close, back, add, new chat). */
const CONTROL = 36;
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.9;

/**
 * A bottom sheet page: a route shown as a sheet over the previous page. It slides up, and
 * closes by dragging the handle or title down, tapping the dimmed area, pressing Escape on
 * the web, or using the close button, so it works for touch, keyboard and screen readers.
 */
export function SheetPage({
  title,
  hideTitle,
  onBack,
  action,
  children,
}: {
  title: string;
  /** Keep the title for screen readers only, to give the content the space (the companion). */
  hideTitle?: boolean;
  /** Shows a back chevron before the title, for a sub-view inside the sheet. */
  onBack?: () => void;
  /** An extra round button beside the close button (for example "add"). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const sheetHeight = Math.min(height - Math.max(top, 16) - 8, 780);
  const y = useRef(new Animated.Value(sheetHeight)).current;
  const native = Platform.OS !== 'web';

  useEffect(() => {
    Animated.timing(y, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [y, native]);

  const close = useCallback(() => {
    Animated.timing(y, { toValue: sheetHeight, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: native }).start(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    });
  }, [y, sheetHeight, native]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Dragging the handle or title area down follows the finger; letting go past a distance or with speed closes.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) y.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) close();
          else Animated.spring(y, { toValue: 0, useNativeDriver: native, bounciness: 4 }).start();
        },
        onPanResponderTerminate: () => Animated.spring(y, { toValue: 0, useNativeDriver: native }).start(),
      }),
    [y, close, native],
  );

  // On the web, react-native-web's responder system does not follow a mouse drag reliably,
  // so the same gesture is handled with pointer events there.
  const headerRef = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = headerRef.current as unknown as HTMLElement | null;
    if (!el) return;
    let active = false;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, [role="button"]')) return; // the close button stays a button
      active = true;
      startY = lastY = e.clientY;
      lastT = e.timeStamp;
      velocity = 0;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!active) return;
      const dy = e.clientY - startY;
      if (dy > 0) y.setValue(dy);
      velocity = (e.clientY - lastY) / Math.max(1, e.timeStamp - lastT);
      lastY = e.clientY;
      lastT = e.timeStamp;
    };
    const up = (e: PointerEvent) => {
      if (!active) return;
      active = false;
      const dy = e.clientY - startY;
      if (dy > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) close();
      else Animated.spring(y, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [y, close]);

  const scrimOpacity = y.interpolate({ inputRange: [0, sheetHeight], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(42, 34, 48, 0.45)', opacity: scrimOpacity }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={title}
        {...(Platform.OS === 'web' ? ({ role: 'dialog', 'aria-modal': true, 'aria-label': title } as object) : {})}
        style={[styles.sheet, { height: sheetHeight, transform: [{ translateY: y }] }]}
      >
        <View ref={headerRef} {...(Platform.OS === 'web' ? {} : pan.panHandlers)} style={styles.header}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Drag down to close ${title}`}
            accessibilityActions={[{ name: 'escape', label: 'Close' }]}
            onAccessibilityAction={close}
            style={styles.handleArea}
          >
            <View style={styles.handle} />
          </View>
          {hideTitle ? (
            <View style={styles.actionRow}>
              <View>{action}</View>
              <IconButton icon="close" label={`Close ${title}`} variant="solid" size={CONTROL} onPress={close} />
            </View>
          ) : (
            <View style={styles.titleRow}>
              {onBack ? <IconButton icon="chevron-left" label="Back" variant="solid" size={CONTROL} onPress={onBack} /> : null}
              <Text variant="title" style={{ flex: 1, fontSize: 22, lineHeight: 28 }} numberOfLines={1}>
                {title}
              </Text>
              {action}
              <IconButton icon="close" label={`Close ${title}`} variant="solid" size={CONTROL} onPress={close} />
            </View>
          )}
        </View>
        <SheetContext.Provider value>
          <View style={{ flex: 1 }}>{children}</View>
        </SheetContext.Provider>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 640,
    backgroundColor: colors.page,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    overflow: 'hidden',
    boxShadow: '0 -8px 32px rgba(42, 34, 48, 0.12)',
  } as object,
  header: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm, userSelect: 'none', touchAction: 'none' } as object,
  handleArea: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.sm, minHeight: 28 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.surfaceTertiary },
  // Title hidden: new-chat style action on the left, close on the right, clear of the handle.
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
