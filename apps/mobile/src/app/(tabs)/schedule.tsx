import { router } from 'expo-router';
import { appToday } from '@/lib/today';
import { useState } from 'react';
import { View } from 'react-native';
import { spacing } from '@/theme/tokens';
import { addDays, dayOfWeek } from '@mova/shared';
import { Button, Card, DateRangeHeader, ErrorState, FAB_CLEARANCE, FloatingChatButton, LoadingState, RuneIcon, Screen, Section, Text, TileRow, tileKindFor } from '@/components';
import { WeekStrip } from '@/components/domain';
import { useProfile, useSchedule } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { formatDate, formatTimeRange } from '@/lib/format';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** WF-11 unified schedule: workouts, runs and the meal timetable together. */
export default function Schedule() {
  const profile = useProfile();
  const today = appToday(profile.data?.timezone ?? 'UTC');
  const monday = addDays(today, -((dayOfWeek(today) + 6) % 7));
  const [weekStart, setWeekStart] = useState(monday);
  const [selected, setSelected] = useState(today);
  const weekEnd = addDays(weekStart, 6);
  const schedule = useSchedule(weekStart, weekEnd);

  const marks: Record<string, number> = {};
  for (const s of schedule.data?.sessions ?? []) {
    const d = s.plannedDate ?? s.actualDate;
    if (d && s.status !== 'cancelled') marks[d] = (marks[d] ?? 0) + 1;
  }
  const daySessions = (schedule.data?.sessions ?? []).filter((s) => (s.plannedDate ?? s.actualDate) === selected);

  return (
    <Screen refreshing={schedule.isRefetching} onRefresh={() => schedule.refetch()} overlay={<FloatingChatButton />} endInset={FAB_CLEARANCE}>
      <DateRangeHeader
        label={`${formatDate(weekStart)} – ${formatDate(weekEnd)}`}
        onPrevious={() => { setWeekStart(addDays(weekStart, -7)); setSelected(addDays(weekStart, -7)); }}
        onNext={() => { setWeekStart(addDays(weekStart, 7)); setSelected(addDays(weekStart, 7)); }}
      />
      <WeekStrip start={weekStart} selected={selected} onSelect={setSelected} marks={marks} />
      {schedule.isPending ? <LoadingState /> : null}
      {schedule.isError ? <ErrorState message={errorMessage(schedule.error)} onRetry={() => schedule.refetch()} /> : null}
      {schedule.data ? (
        <>
          <Section title={selected === today ? "Today's activities" : `${WEEKDAYS[dayOfWeek(selected)]}'s activities`}>
            {daySessions.length ? (
              <View style={{ gap: spacing.sm }}>
                {daySessions.map((s) => (
                  <Card key={s.id}>
                    <TileRow
                      kind={tileKindFor(s.activityType)}
                      title={s.title}
                      subtitle={formatTimeRange(s.plannedTime, s.plannedDurationMinutes)}
                      link={s.activityType === 'strength' ? 'View workout' : undefined}
                      onPress={() => router.push(`/session/${s.id}`)}
                      accessibilityLabel={`${s.title}, ${s.status}`}
                    />
                  </Card>
                ))}
              </View>
            ) : (
              <Card tone="subtle">
                <Text variant="small" color="inkSecondary">
                  Nothing scheduled.
                </Text>
              </Card>
            )}
          </Section>
          <View style={{ alignItems: 'center' }}>
            <Button
              label="Schedule a run or activity"
              variant="secondary"
              icon={<RuneIcon name="plus" size={18} />}
              onPress={() => router.push(`/activity/schedule?date=${selected >= today ? selected : today}`)}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}
