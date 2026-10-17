import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { dayOfWeek, groupMealsByWeekday, WEEKDAY_NAMES, type MealPlan, type MealPlanEntryDto } from '@mova/shared';
import { Card, Divider, EmptyState, ErrorState, FastingPanel, LoadingState, PressableCard, Screen, Section, Text } from '@/components';
import { useProfile, useMealPlan, useMealPlans } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { appToday } from '@/lib/today';
import { colors, spacing } from '@/theme/tokens';

type Page = 'meals' | 'fasting';

/** Meal plan: a two-page slider. Page one is the meal list for a chosen day; page two is the fasting clock. */
export default function MealPlanPage() {
  const params = useLocalSearchParams<{ page?: string }>();
  const [page, setPage] = useState<Page>(params.page === 'fasting' ? 'fasting' : 'meals');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Tab scenes are transparent, so this page (tabs line included) must hide itself when another tab is showing.
  const focused = useIsFocused();

  // 0 = Meals page fully showing, 1 = Fasting page fully showing; follows the finger while swiping.
  const progress = useRef(new Animated.Value(page === 'fasting' ? 1 : 0)).current;
  const pageRef = useRef(page);

  const goTo = (next: Page) => {
    pageRef.current = next;
    setPage(next);
    if (width) scroller.current?.scrollTo({ x: next === 'fasting' ? width : 0, animated: true });
  };
  // Open on the right page once the width is known, and follow a deep link such as "open fasting".
  useEffect(() => {
    if (width && params.page && (params.page === 'fasting' || params.page === 'meals')) goTo(params.page);
    else if (width && page === 'fasting') scroller.current?.scrollTo({ x: width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, params.page]);

  return (
    <View style={[{ flex: 1 }, !focused && { display: 'none' }]}>
      <View style={styles.tabs}>
        <PagerTabs page={page} progress={progress} onChange={goTo} />
      </View>
      <View style={{ flex: 1 }} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {width > 0 && height > 0 ? (
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              // The pages' own vertical scrolling bubbles up here too; only the slider (two pages wide) counts.
              if (e.nativeEvent.contentSize.width < width * 1.5) return;
              const x = e.nativeEvent.contentOffset.x;
              progress.setValue(Math.min(1, Math.max(0, x / width)));
              const next: Page = x >= width / 2 ? 'fasting' : 'meals';
              if (next !== pageRef.current) {
                pageRef.current = next;
                setPage(next);
              }
            }}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {/* Each page gets the slider's exact height so its own content can scroll. */}
            <View style={{ width, height }}>
              <Screen>
                <MealsPage />
              </Screen>
            </View>
            <View style={{ width, height }}>
              <Screen>
                <FastingPanel />
              </Screen>
            </View>
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

/** Two tab labels with a rose line that slides along with the swipe (not just when a label is tapped). */
function PagerTabs({ page, progress, onChange }: { page: Page; progress: Animated.Value; onChange: (p: Page) => void }) {
  const [w, setW] = useState(0);
  const tabs: Array<{ key: Page; label: string }> = [
    { key: 'meals', label: 'Meals' },
    { key: 'fasting', label: 'Fasting' },
  ];
  return (
    <View accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row' }}>
        {tabs.map((t) => (
          <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: page === t.key }} accessibilityLabel={t.label} onPress={() => onChange(t.key)} style={styles.tab}>
            <Text variant="bodyStrong" color={page === t.key ? 'ink' : 'inkTertiary'} align="center">
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.indicator, { width: w / 2, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, w / 2] }) }] }]} />
      </View>
    </View>
  );
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function MealsPage() {
  const profile = useProfile();
  const plans = useMealPlans();
  const active = plans.data?.find((p) => p.status === 'active');
  const current = useMealPlan(active?.id);
  const today = appToday(profile.data?.timezone ?? 'UTC');
  const [day, setDay] = useState(dayOfWeek(today)); // 0 = Sunday
  if (plans.isPending) return <LoadingState />;
  if (plans.isError) return <ErrorState message={errorMessage(plans.error)} onRetry={() => plans.refetch()} />;

  const past = plans.data.filter((p) => p.status !== 'active');
  return (
    <View style={{ gap: spacing.lg }}>
      {!active ? (
        <EmptyState mood="nutrition" title="No meal plan" body="Ask the companion to draft one." />
      ) : current.isPending ? (
        <LoadingState />
      ) : current.isError ? (
        <ErrorState message={errorMessage(current.error)} onRetry={() => current.refetch()} />
      ) : current.data ? (
        <DayMeals plan={current.data} day={day} onDay={setDay} todayDay={dayOfWeek(today)} />
      ) : null}

      {past.length > 0 ? (
        <>
          <Divider />
          <Section title="Previous plans">
            {past.map((p) => (
              <PressableCard key={p.id} accessibilityLabel={`Open ${p.title}`} onPress={() => router.push(`/meal/${p.id}`)}>
                <Text variant="bodyStrong">{p.title}</Text>
                <Text variant="small" color="inkTertiary">
                  {formatDate(p.startDate)} – {formatDate(p.endDate)} · {p.status}
                </Text>
              </PressableCard>
            ))}
          </Section>
        </>
      ) : null}
    </View>
  );
}

/** The card for one day: its meals in order. */
function DayCard({ title, meals, minHeight, onHeight }: { title: string; meals: MealPlanEntryDto[]; minHeight?: number; onHeight?: (h: number) => void }) {
  return (
    <Card style={[{ gap: spacing.md }, minHeight ? { minHeight } : null]} onLayout={onHeight ? (e) => onHeight(e.nativeEvent.layout.height) : undefined}>
      <Text variant="title">{title}</Text>
      {meals.length === 0 ? (
        <Text variant="small" color="inkTertiary">
          Nothing planned for this day.
        </Text>
      ) : (
        meals.map((e, i) => (
          <View key={e.id} style={{ gap: 2 }}>
            {i > 0 ? <Divider /> : null}
            <Text variant="eyebrow" color="roseDeep">
              {e.slot}
              {e.isSmoothie ? ' · smoothie' : ''}
            </Text>
            <Text variant="bodyStrong">{e.mealName}</Text>
            {e.description ? (
              <Text variant="small" color="inkSecondary">
                {e.description}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </Card>
  );
}

/**
 * The full meal card for one day, with a row of day circles (S M T W T F S) beneath it to switch days.
 * The card is always as tall as the fullest day of the week, so it never jumps while you swipe through days.
 */
function DayMeals({ plan, day, onDay, todayDay }: { plan: MealPlan; day: number; onDay: (d: number) => void; todayDay: number }) {
  const byWeekday = new Map(groupMealsByWeekday(plan.entries));
  const weekday = (d: number) => (d + 6) % 7; // Sunday-first circle -> Monday-first plan
  const titleOf = (d: number) => (d === todayDay ? 'Today' : WEEKDAY_NAMES[weekday(d)]!);
  const mealsOf = (d: number) => byWeekday.get(weekday(d)) ?? [];
  const [heights, setHeights] = useState<Record<number, number>>({});
  const tallest = Math.max(0, ...Object.values(heights));
  return (
    <View style={{ gap: spacing.lg }}>
      {/* Invisible copies of every day, only to measure the tallest one. */}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: 0, right: 0, opacity: 0 }}>
        {DAY_LETTERS.map((_, d) => (
          <DayCard key={d} title={titleOf(d)} meals={mealsOf(d)} onHeight={(h) => setHeights((prev) => (prev[d] === h ? prev : { ...prev, [d]: h }))} />
        ))}
      </View>
      <DayCard title={titleOf(day)} meals={mealsOf(day)} minHeight={tallest || undefined} />
      <View accessibilityRole="tablist" style={styles.days}>
        {DAY_LETTERS.map((letter, d) => {
          const selected = d === day;
          const has = mealsOf(d).length > 0;
          return (
            <Pressable
              key={d}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${WEEKDAY_NAMES[weekday(d)]}${d === todayDay ? ', today' : ''}${has ? '' : ', nothing planned'}`}
              onPress={() => onDay(d)}
              style={[styles.dayCircle, selected ? { backgroundColor: colors.rose } : d === todayDay ? { borderColor: colors.rose, borderWidth: 2 } : null]}
            >
              <Text variant="label" color={selected ? 'onInk' : has ? 'ink' : 'inkTertiary'}>
                {letter}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: spacing.base },
  tab: { flex: 1, minHeight: 44, justifyContent: 'center' },
  track: { height: 2, backgroundColor: colors.hairline },
  indicator: { height: 2, backgroundColor: colors.rose },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
});
