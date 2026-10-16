import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formatVolume, fromMl, hydrationProgress, type VolumeUnit } from '@mova/shared';
import { Banner, Button, Card, ErrorState, LoadingState, Mascot, NumberField, Row, Screen, Section, Segmented, Text } from '@/components';
import { useHydration, useHydrationMutations, useProfile } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { spacing } from '@/theme/tokens';

const QUICK: Record<VolumeUnit, number[]> = { ml: [250, 330, 500], l: [0.25, 0.5, 1], fl_oz: [8, 12, 16] };

/** WF-13 hydration (optional). Explicit units, user-set goal, no shaming. */
export default function Hydration() {
  const profile = useProfile();
  const day = useHydration();
  const m = useHydrationMutations();
  const unit = profile.data?.volumeUnit ?? 'ml';
  const [goal, setGoal] = useState<number | undefined>();
  const [goalUnit, setGoalUnit] = useState<VolumeUnit>(unit);
  const [custom, setCustom] = useState<number | undefined>();

  if (day.isPending) return <LoadingState />;
  if (day.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(day.error)} onRetry={() => day.refetch()} />
      </Screen>
    );
  const d = day.data;
  if (!d.enabled) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hydration' }} />
        <Banner tone="info" title="Hydration is turned off">
          Turn it on in Settings if you'd like to track water. Any past entries are kept.
        </Banner>
        <Button label="Open settings" onPress={() => router.push('/settings')} />
      </Screen>
    );
  }
  const progress = d.target ? hydrationProgress(d.totalMl, d.target.dailyTarget, d.target.unit) : null;
  const err = m.add.error ?? m.setTarget.error ?? m.remove.error;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Hydration' }} />
      <Row>
        <Mascot mood="hydration" size={88} />
        <View style={{ flex: 1 }}>
          <Text variant="title">{formatVolume(d.totalMl, unit)}</Text>
          <Text variant="small" color="inkSecondary">
            {progress ? `${formatVolume(progress.remainingMl, unit)} to your goal of ${formatVolume(progress.targetMl, unit)}` : 'No daily goal yet'}
          </Text>
        </View>
      </Row>
      <Section title="Add water">
        <Row style={{ flexWrap: 'wrap' }}>
          {QUICK[unit].map((q) => (
            <Button key={q} label={`+ ${q} ${unit === 'fl_oz' ? 'fl oz' : unit}`} variant="secondary" loading={m.add.isPending && m.add.variables?.quantity === q} onPress={() => m.add.mutate({ quantity: q, unit, idempotencyKey: newIdempotencyKey() })} />
          ))}
        </Row>
        <Row style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <NumberField label="Other amount" unit={unit === 'fl_oz' ? 'fl oz' : unit} value={custom} onChange={setCustom} />
          </View>
          <Button label="Add" disabled={!custom || custom <= 0} onPress={() => custom && m.add.mutate({ quantity: custom, unit, idempotencyKey: newIdempotencyKey() }, { onSuccess: () => setCustom(undefined) })} />
        </Row>
      </Section>
      {d.entries.length ? (
        <Section title="Today's entries">
          {d.entries.map((e) => (
            <Card key={e.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="body">
                  {e.quantity} {e.unit === 'fl_oz' ? 'fl oz' : e.unit} · {new Date(e.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Button label="Remove" size="sm" variant="ghost" onPress={() => m.remove.mutate(e.id)} />
              </Row>
            </Card>
          ))}
        </Section>
      ) : null}
      <Section title="Daily goal">
        <Text variant="small" color="inkSecondary">
          Choose a goal that suits you. Needs vary from person to person; Mova doesn't give medical guidance on how much to drink.
        </Text>
        <Row style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <NumberField label="Goal" value={goal ?? (d.target ? fromMl(progress!.targetMl, goalUnit) : undefined)} onChange={setGoal} />
          </View>
          <Segmented options={[{ value: 'ml', label: 'ml' }, { value: 'l', label: 'L' }, { value: 'fl_oz', label: 'fl oz' }]} value={goalUnit} onChange={setGoalUnit} />
        </Row>
        <Button label="Save goal" variant="secondary" disabled={!goal} loading={m.setTarget.isPending} onPress={() => goal && m.setTarget.mutate({ dailyTarget: goal, unit: goalUnit })} />
      </Section>
      {err ? <Banner tone="error">{errorMessage(err)}</Banner> : null}
      <View style={{ height: spacing.lg }} />
    </Screen>
  );
}
