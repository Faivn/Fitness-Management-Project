import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { fastingStatus, isLocalTime } from '@mova/shared';
import { useFasting, useFastingMutations, useProfile, useUpdatePreferences } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { colors, spacing } from '@/theme/tokens';
import { Button } from './Button';
import { ExpandableCard, TextAction } from './controls';
import { NumberField, TextField } from './Form';
import { Card, Divider, Row, Section } from './Layout';
import { Mascot } from './Mascot';
import { Banner, ErrorState, LoadingState } from './States';
import { Text } from './Text';

const SIZE = 268;
const STROKE = 3;

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Clock-style dial: a hairline ring with tick marks around the inside (like a watch or speedometer face),
 * a thin rose arc for progress, ticks that turn rose as time passes, and a small marker at the tip.
 */
function Dial({ fraction, children, label }: { fraction: number; children: React.ReactNode; label: string }) {
  const r = SIZE / 2 - 8;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));
  const angle = f * 2 * Math.PI - Math.PI / 2;
  const tip = { x: SIZE / 2 + r * Math.cos(angle), y: SIZE / 2 + r * Math.sin(angle) };
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
    const major = i % 5 === 0;
    const from = r - 12;
    const to = r - (major ? 24 : 18);
    return { i, major, x1: SIZE / 2 + from * Math.cos(a), y1: SIZE / 2 + from * Math.sin(a), x2: SIZE / 2 + to * Math.cos(a), y2: SIZE / 2 + to * Math.sin(a), done: i / 60 <= f && f > 0 };
  });
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(f * 100) }}
      style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}
    >
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={colors.hairline} strokeWidth={STROKE} fill="none" />
        {ticks.map((t) => (
          <Line key={t.i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.done ? colors.rose : colors.inkSoft} strokeWidth={t.major ? 2 : 1} strokeLinecap="round" />
        ))}
        {f > 0 ? (
          <>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              stroke={colors.rose}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${c * f} ${c}`}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
            <Circle cx={tip.x} cy={tip.y} r={6} fill={colors.rose} />
            <Circle cx={tip.x} cy={tip.y} r={2.5} fill={colors.onInk} />
          </>
        ) : null}
      </Svg>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>{children}</View>
    </View>
  );
}

/**
 * Fasting page: a centred pomodoro-style dial (elapsed time, percent, remaining), start and goal times,
 * and one action. If fasting is off, it is turned on here rather than in Settings.
 */
export function FastingPanel() {
  const profile = useProfile();
  const state = useFasting();
  const m = useFastingMutations();
  const prefs = useUpdatePreferences();
  const [startTime, setStartTime] = useState('20:00');
  const [hours, setHours] = useState<number | undefined>(16);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (state.data?.schedule) {
      setStartTime(state.data.schedule.fastStartTime);
      setHours(state.data.schedule.fastHours);
    }
  }, [state.data?.schedule]);

  if (state.isPending) return <LoadingState />;
  if (state.isError) return <ErrorState message={errorMessage(state.error)} onRetry={() => state.refetch()} />;
  const f = state.data;

  if (!f.enabled) {
    return (
      <View style={{ alignItems: 'center', gap: spacing.base, paddingTop: spacing.xl }}>
        <Mascot mood="calm" size={140} />
        <Text variant="title" align="center">
          Intermittent fasting
        </Text>
        <Text variant="small" color="inkSecondary" align="center" style={{ maxWidth: 300 }}>
          Choose an eating window that suits you and follow it on a simple clock. It is optional, and you can turn it off any time.
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Button label="Turn on fasting" loading={prefs.isPending} onPress={() => prefs.mutate({ fastingEnabled: true })} />
        </View>
        {prefs.isError ? <Banner tone="error">{errorMessage(prefs.error)}</Banner> : null}
      </View>
    );
  }

  const status = fastingStatus(f.schedule, f.activeFast, now, profile.data?.timezone ?? 'UTC');
  const on = status.state === 'fasting';
  const total = on ? new Date(status.endsAt).getTime() - new Date(status.startedAt).getTime() : 0;
  const elapsed = on ? now.getTime() - new Date(status.startedAt).getTime() : 0;
  const left = on ? Math.max(0, total - elapsed) : 0;
  const plannedHours = f.schedule?.fastHours ?? hours ?? 16;
  const err = m.start.error ?? m.end.error ?? m.setSchedule.error ?? prefs.error;

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.lg, alignItems: 'stretch', paddingVertical: spacing.xl }}>
        {on ? (
          <Dial fraction={status.fraction} label={`Fasting, ${Math.round(status.fraction * 100)} percent of your goal`}>
            <Text variant="caption" color="inkTertiary">
              Elapsed time ({Math.round(status.fraction * 100)}%)
            </Text>
            <Text style={{ fontSize: 36, lineHeight: 42, fontWeight: '600', letterSpacing: -0.5 }}>{clock(elapsed)}</Text>
            <View style={{ backgroundColor: colors.roseWash, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
              <Text variant="caption" color="roseDeep">
                {left > 0 ? `${clock(left)} left` : 'Goal reached'}
              </Text>
            </View>
          </Dial>
        ) : (
          <Dial fraction={0} label="Not fasting">
            <Text variant="caption" color="inkTertiary">
              Upcoming fast
            </Text>
            <Text style={{ fontSize: 36, lineHeight: 42, fontWeight: '600', letterSpacing: -0.5 }}>{plannedHours} hours</Text>
            {status.state === 'not_fasting' && status.nextFastStartsAt ? (
              <Text variant="caption" color="inkTertiary">
                Window starts {when(status.nextFastStartsAt)}
              </Text>
            ) : null}
          </Dial>
        )}

        {on ? (
          <Row style={{ justifyContent: 'space-around', alignItems: 'flex-start' }}>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text variant="eyebrow" color="inkTertiary">
                Started
              </Text>
              <Text variant="bodyStrong">{when(status.startedAt)}</Text>
            </View>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text variant="eyebrow" color="inkTertiary">
                Goal
              </Text>
              <Text variant="bodyStrong">{when(status.endsAt)}</Text>
            </View>
          </Row>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          {f.activeFast ? (
            <Button label="End fast" variant="secondary" loading={m.end.isPending} onPress={() => m.end.mutate()} />
          ) : (
            <Button
              label="Start fasting"
              loading={m.start.isPending}
              onPress={() => m.start.mutate({ plannedHours, idempotencyKey: newIdempotencyKey() })}
            />
          )}
        </View>
        {on && status.basis === 'schedule' ? (
          <Text variant="caption" color="inkTertiary" align="center">
            This is your planned window. Only fasts you start here are recorded.
          </Text>
        ) : null}
      </Card>

      <ExpandableCard title="Fasting window" summary={f.schedule ? `${f.schedule.fastStartTime} · ${f.schedule.fastHours}h` : 'Not set'}>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <TextField lightLabel label="Starts at" value={startTime} onChangeText={setStartTime} error={!isLocalTime(startTime) ? 'Use HH:MM.' : undefined} />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField lightLabel label="Length" unit="hours" value={hours} onChange={setHours} />
          </View>
        </Row>
        <Button
          label="Save window"
          variant="secondary"
          disabled={!isLocalTime(startTime) || !hours || hours < 1 || hours > 72}
          loading={m.setSchedule.isPending}
          onPress={() => hours && m.setSchedule.mutate({ fastStartTime: startTime, fastHours: hours })}
        />
      </ExpandableCard>

      {f.recentFasts.length ? (
        <>
          <Divider />
          <Section title="Recorded fasts">
            {f.recentFasts.map((r) => (
              <Card key={r.id}>
                <Text variant="small">
                  {when(r.startedAt)} → {r.endedAt ? when(r.endedAt) : 'in progress'} · goal {r.plannedHours}h
                </Text>
              </Card>
            ))}
          </Section>
        </>
      ) : null}

      {err ? <Banner tone="error">{errorMessage(err)}</Banner> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        <TextAction label="Turn off fasting" onPress={() => prefs.mutate({ fastingEnabled: false })} />
      </View>
    </View>
  );
}
