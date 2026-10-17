import { View } from 'react-native';
import { spacing } from '@/theme/tokens';
import { router, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Banner, Button, Divider, ErrorState, ExpandableCard, LoadingState, IconButton, PressableCard, Row, RuneIcon, Screen, SheetPage, Section, Segmented, Text, TextField, ToggleRow } from '@/components';
import { GoalsPanel } from '@/app/goals';
import { useOnboarding } from '@/lib/onboarding';
import { useGoals, useProfile, useUpdatePreferences } from '@/hooks/api';
import { errorMessage, resetDemo } from '@/lib/api';
import { copy } from '@/lib/copy';
import { deviceTimeZone } from '@/lib/format';
import { ensureNotificationPermission } from '@/lib/reminders';

/**
 * WF-16 basic preferences. Changes affect future behaviour only; turning a
 * module off never deletes its history.
 */
function SettingsBody({ onOpenGoals }: { onOpenGoals: () => void }) {
  const profile = useProfile();
  const goals = useGoals();
  const update = useUpdatePreferences();
  const queryClient = useQueryClient();
  const onboarding = useOnboarding();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [permissionNote, setPermissionNote] = useState<string | null>(null);

  if (profile.isPending) return <LoadingState />;
  if (profile.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(profile.error)} onRetry={() => profile.refetch()} />
      </Screen>
    );
  const p = profile.data;
  const active = (goals.data ?? []).filter((g) => g.status === 'active');
  const goalSummary =
    active.length === 0
      ? { empty: true, text: 'No goals set yet. Tap to add one.', label: 'Goals. None set yet. Open goals' }
      : { empty: false, text: active.map((g) => g.title).join(' · '), label: `Goals: ${active.map((g) => g.title).join(', ')}. Open goals` };
  const device = deviceTimeZone();

  async function toggleReminders(on: boolean) {
    setPermissionNote(null);
    if (on) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        setPermissionNote('Notifications are blocked. Allow them in device settings.');
        return;
      }
    }
    update.mutate({ workoutRemindersEnabled: on });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Settings' }} />
      {update.isError ? <Banner tone="error">{errorMessage(update.error)}</Banner> : null}
      {update.isSuccess ? <Banner tone="success">Saved.</Banner> : null}

      <Section title="Units">
        <Segmented inline label="Weight" options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} value={p.weightUnit} onChange={(weightUnit) => update.mutate({ weightUnit })} />
        <Segmented inline label="Distance" options={[{ value: 'km', label: 'km' }, { value: 'mi', label: 'mi' }]} value={p.distanceUnit} onChange={(distanceUnit) => update.mutate({ distanceUnit })} />
        <Segmented
          inline
          label="Water"
          options={[{ value: 'ml', label: 'ml' }, { value: 'l', label: 'L' }, { value: 'fl_oz', label: 'fl oz' }]}
          value={p.volumeUnit}
          onChange={(volumeUnit) => update.mutate({ volumeUnit })}
        />
      </Section>

      <Divider />

      <Section title="Time zone">
        <Text variant="body">{p.timezone}</Text>
        {device !== p.timezone ? (
          <Button label={`Use this device's time zone (${device})`} size="sm" variant="secondary" onPress={() => update.mutate({ timezone: device })} />
        ) : null}
        
      </Section>

      <Divider />

      <Section title="Goals">
        <PressableCard accessibilityLabel={goalSummary.label} onPress={onOpenGoals}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" color={goalSummary.empty ? 'inkTertiary' : 'ink'} style={{ flex: 1 }}>
              {goalSummary.text}
            </Text>
            <RuneIcon name="chevron-right" size={20} color="inkTertiary" />
          </Row>
        </PressableCard>
      </Section>

      <Divider />

      <Section title="Training equipment">
        <TextField
          label="Training equipment"
          hideLabel
          placeholder="Enter the equipment you use"
          value={equipment ?? p.equipment.join(', ')}
          onChangeText={setEquipment}
          // Saved when the field loses focus; there is no separate Save step.
          onBlur={() => {
            if (equipment === null) return;
            update.mutate({ equipment: equipment.split(',').map((x) => x.trim()).filter(Boolean) });
          }}
        />
      </Section>

      <Divider />

      <Section title="Reminders">
        <ToggleRow
          label="Workout reminders"
          description={`${p.workoutReminderLeadMinutes} minutes before a session.`}
          value={p.workoutRemindersEnabled}
          onChange={toggleReminders}
        />
        {permissionNote ? <Banner tone="warning">{permissionNote}</Banner> : null}
      </Section>

      <Divider />

      <Section>
        {resetError ? <Banner tone="error">{resetError}</Banner> : null}
        {confirmReset ? (
          <>
            <Text variant="bodyStrong">{copy.demo.resetConfirm}</Text>
            <Row style={{ alignItems: 'stretch', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
            <Button
              fullWidth
              label={copy.actions.confirm}
              variant="danger"
              loading={resetting}
              onPress={() => {
                setResetError(null);
                setResetting(true);
                resetDemo()
                  .then(() => {
                    onboarding.reset();
                    queryClient.clear();
                    setConfirmReset(false);
                    if (router.canDismiss()) router.dismissAll();
                    router.replace('/');
                  })
                  .catch((e) => setResetError(errorMessage(e)))
                  .finally(() => setResetting(false));
              }}
            />
            </View>
            <View style={{ flex: 1 }}>
              <Button fullWidth label={copy.actions.cancel} variant="secondary" disabled={resetting} onPress={() => setConfirmReset(false)} />
            </View>
            </Row>
          </>
        ) : (
          <Button label={copy.demo.resetAction} variant="secondary" onPress={() => setConfirmReset(true)} />
        )}
      </Section>
    </Screen>
  );
}

export default function Settings() {
  const [view, setView] = useState<'main' | 'goals'>('main');
  const [addOpen, setAddOpen] = useState(false);
  return (
    <SheetPage
      title={view === 'goals' ? 'Goals' : 'Settings'}
      onBack={view === 'goals' ? () => setView('main') : undefined}
      action={view === 'goals' ? <IconButton icon="plus" label="Add a goal" variant="solid" onPress={() => setAddOpen(true)} /> : undefined}
    >
      {view === 'goals' ? <GoalsPanel addOpen={addOpen} setAddOpen={setAddOpen} /> : <SettingsBody onOpenGoals={() => setView('goals')} />}
    </SheetPage>
  );
}
