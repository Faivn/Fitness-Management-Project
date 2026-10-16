import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { fastingStatus, isLocalTime } from '@mova/shared';
import { Banner, Button, Card, Chip, ErrorState, LoadingState, Mascot, NumberField, Row, Screen, Section, Text, TextField } from '@/components';
import { useFasting, useFastingMutations, useProfile } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';

const PRESETS = [12, 14, 16, 18];

/**
 * WF-14 intermittent fasting (optional). The schedule and recorded fasts are
 * separate; a planned window is never counted as a completed fast. No
 * physiological claims are made.
 */
export default function Fasting() {
  const profile = useProfile();
  const state = useFasting();
  const m = useFastingMutations();
  const [startTime, setStartTime] = useState('20:00');
  const [hours, setHours] = useState<number | undefined>(16);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (state.data?.schedule) {
      setStartTime(state.data.schedule.fastStartTime);
      setHours(state.data.schedule.fastHours);
    }
  }, [state.data?.schedule]);

  if (state.isPending) return <LoadingState />;
  if (state.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(state.error)} onRetry={() => state.refetch()} />
      </Screen>
    );
  const f = state.data;
  if (!f.enabled) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Fasting' }} />
        <Banner tone="info" title="Fasting is turned off">
          It's optional. Turn it on in Settings if you want it — past records are kept either way.
        </Banner>
        <Button label="Open settings" onPress={() => router.push('/settings')} />
      </Screen>
    );
  }
  const status = fastingStatus(f.schedule, f.activeFast, now, profile.data?.timezone ?? 'UTC');
  const err = m.start.error ?? m.end.error ?? m.setSchedule.error;
  const time = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Fasting' }} />
      <Row>
        <Mascot mood="calm" size={88} />
        <View style={{ flex: 1 }}>
          {status.state === 'fasting' ? (
            <>
              <Text variant="title">{status.basis === 'manual' ? 'Fasting' : 'In your fasting window'}</Text>
              <Text variant="small" color="inkSecondary">
                Since {time(status.startedAt)} · until {time(status.endsAt)}
              </Text>
            </>
          ) : (
            <>
              <Text variant="title">Not fasting</Text>
              <Text variant="small" color="inkSecondary">
                {status.nextFastStartsAt ? `Next window starts ${time(status.nextFastStartsAt)}` : 'No schedule set'}
              </Text>
            </>
          )}
        </View>
      </Row>
      {f.activeFast ? (
        <Button label="End fast" fullWidth loading={m.end.isPending} onPress={() => m.end.mutate()} />
      ) : (
        <Button label={`Start a ${hours ?? 16}-hour fast now`} fullWidth variant="secondary" loading={m.start.isPending} onPress={() => m.start.mutate({ plannedHours: hours ?? 16, idempotencyKey: newIdempotencyKey() })} />
      )}
      {status.state === 'fasting' && status.basis === 'schedule' ? (
        <Text variant="caption" color="inkTertiary">
          This is your planned window. Only fasts you start and end here are recorded as fasts.
        </Text>
      ) : null}

      <Section title="Schedule">
        <Row style={{ flexWrap: 'wrap' }}>
          {PRESETS.map((h) => (
            <Chip key={h} label={`${h}:${24 - h}`} selected={hours === h} onPress={() => setHours(h)} />
          ))}
        </Row>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <TextField label="Fast starts at" value={startTime} onChangeText={setStartTime} error={!isLocalTime(startTime) ? 'Use HH:MM.' : undefined} />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Length" unit="hours" value={hours} onChange={setHours} />
          </View>
        </Row>
        <Button
          label="Save schedule"
          variant="secondary"
          disabled={!isLocalTime(startTime) || !hours || hours < 1 || hours > 72}
          loading={m.setSchedule.isPending}
          onPress={() => hours && m.setSchedule.mutate({ fastStartTime: startTime, fastHours: hours })}
        />
        <Text variant="caption" color="inkTertiary">
          Fasting isn't suitable for everyone. If you have a health condition, are pregnant, or have a history of disordered eating, talk to a
          professional first. Your meal plan is never changed automatically because of a fasting schedule.
        </Text>
      </Section>
      {f.recentFasts.length ? (
        <Section title="Recorded fasts">
          {f.recentFasts.map((r) => (
            <Card key={r.id}>
              <Text variant="small">
                {time(r.startedAt)} → {r.endedAt ? time(r.endedAt) : 'in progress'} · planned {r.plannedHours}h
              </Text>
            </Card>
          ))}
        </Section>
      ) : null}
      {err ? <Banner tone="error">{errorMessage(err)}</Banner> : null}
    </Screen>
  );
}
