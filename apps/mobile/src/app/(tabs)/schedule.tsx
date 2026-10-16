import { router } from 'expo-router';
import { useState } from 'react';
import { addDays, dayOfWeek, todayIn } from '@mova/shared';
import { Button, Card, ErrorState, LoadingState, Row, Screen, Section, Text } from '@/components';
import { MealSlotCard, SessionCard, WeekStrip } from '@/components/domain';
import { useProfile, useSchedule } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';

/** WF-11 unified schedule: workouts, runs and the meal timetable together. */
export default function Schedule() {
  const profile = useProfile();
  const today = todayIn(profile.data?.timezone ?? 'UTC');
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
  const dayMeals = (schedule.data?.meals ?? []).filter((m) => m.date === selected);

  return (
    <Screen refreshing={schedule.isRefetching} onRefresh={() => schedule.refetch()}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button label="‹ Previous" size="sm" variant="ghost" onPress={() => { setWeekStart(addDays(weekStart, -7)); setSelected(addDays(weekStart, -7)); }} />
        <Text variant="label">
          {formatDate(weekStart)} – {formatDate(weekEnd)}
        </Text>
        <Button label="Next ›" size="sm" variant="ghost" onPress={() => { setWeekStart(addDays(weekStart, 7)); setSelected(addDays(weekStart, 7)); }} />
      </Row>
      <WeekStrip start={weekStart} selected={selected} onSelect={setSelected} marks={marks} />
      <Row style={{ flexWrap: 'wrap' }}>
        <Button label="Schedule a run or activity" size="sm" variant="secondary" onPress={() => router.push(`/activity/schedule?date=${selected >= today ? selected : today}`)} />
      </Row>
      {schedule.isPending ? <LoadingState /> : null}
      {schedule.isError ? <ErrorState message={errorMessage(schedule.error)} onRetry={() => schedule.refetch()} /> : null}
      {schedule.data ? (
        <>
          <Section title={formatDate(selected, true)}>
            {daySessions.length ? (
              daySessions.map((s) => <SessionCard key={s.id} session={s} />)
            ) : (
              <Card tone="subtle">
                <Text variant="small" color="inkSecondary">
                  Nothing scheduled.
                </Text>
              </Card>
            )}
          </Section>
          {dayMeals.length ? (
            <Section title="Planned meals">
              {dayMeals.map((m) => (
                <MealSlotCard key={m.id} entry={m} />
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
