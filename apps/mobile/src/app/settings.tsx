import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, ErrorState, LoadingState, Screen, Section, Segmented, Text, TextField, ToggleRow } from '@/components';
import { useProfile, useUpdatePreferences } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { deviceTimeZone } from '@/lib/format';
import { ensureNotificationPermission } from '@/lib/reminders';

/**
 * WF-16 basic preferences. Changes affect future behaviour only; turning a
 * module off never deletes its history.
 */
export default function Settings() {
  const profile = useProfile();
  const update = useUpdatePreferences();
  const { signOut, isAnonymous } = useAuth();
  const [equipment, setEquipment] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [permissionNote, setPermissionNote] = useState<string | null>(null);

  if (profile.isPending) return <LoadingState />;
  if (profile.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(profile.error)} onRetry={() => profile.refetch()} />
      </Screen>
    );
  const p = profile.data;
  const device = deviceTimeZone();

  async function toggleReminders(on: boolean) {
    setPermissionNote(null);
    if (on) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        setPermissionNote('Notifications are blocked for Mova. You can allow them in your device settings; everything else keeps working.');
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
        <Segmented label="Weight" options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} value={p.weightUnit} onChange={(weightUnit) => update.mutate({ weightUnit })} />
        <Segmented label="Distance" options={[{ value: 'km', label: 'km' }, { value: 'mi', label: 'mi' }]} value={p.distanceUnit} onChange={(distanceUnit) => update.mutate({ distanceUnit })} />
        <Segmented
          label="Water"
          options={[{ value: 'ml', label: 'ml' }, { value: 'l', label: 'L' }, { value: 'fl_oz', label: 'fl oz' }]}
          value={p.volumeUnit}
          onChange={(volumeUnit) => update.mutate({ volumeUnit })}
        />
      </Section>

      <Section title="Time zone">
        <Text variant="body">{p.timezone}</Text>
        {device !== p.timezone ? (
          <Button label={`Use this device's time zone (${device})`} size="sm" variant="secondary" onPress={() => update.mutate({ timezone: device })} />
        ) : null}
        <Text variant="caption" color="inkTertiary">
          Planned sessions keep the local date and time you chose.
        </Text>
      </Section>

      <Section title="Training">
        <TextField
          label="Equipment you have access to"
          placeholder="e.g. Dumbbells, barbell, resistance bands"
          value={equipment ?? p.equipment.join(', ')}
          onChangeText={setEquipment}
        />
        <TextField
          label="Anything the AI should know"
          placeholder="e.g. Old knee injury — avoid deep lunges"
          value={notes ?? p.trainingNotes ?? ''}
          onChangeText={setNotes}
          multiline
        />
        <Button
          label="Save training preferences"
          size="sm"
          variant="secondary"
          loading={update.isPending}
          onPress={() =>
            update.mutate({
              equipment: (equipment ?? p.equipment.join(',')).split(',').map((s) => s.trim()).filter(Boolean),
              trainingNotes: (notes ?? p.trainingNotes ?? '').trim() || null,
            })
          }
        />
        <Button label="Goals" size="sm" variant="ghost" onPress={() => router.push('/goals')} />
      </Section>

      <Section title="Optional modules">
        <ToggleRow label="Hydration" description="Water goal and intake on your overview." value={p.hydrationEnabled} onChange={(hydrationEnabled) => update.mutate({ hydrationEnabled })} />
        <ToggleRow label="Intermittent fasting" description="Fasting window and status on your overview." value={p.fastingEnabled} onChange={(fastingEnabled) => update.mutate({ fastingEnabled })} />
        <Text variant="caption" color="inkTertiary">
          Turning a module off hides it. Your past entries are kept.
        </Text>
        {p.hydrationEnabled ? <Button label="Open hydration" size="sm" variant="ghost" onPress={() => router.push('/hydration')} /> : null}
        {p.fastingEnabled ? <Button label="Open fasting" size="sm" variant="ghost" onPress={() => router.push('/fasting')} /> : null}
      </Section>

      <Section title="Reminders">
        <ToggleRow
          label="Workout reminders"
          description={`A notification ${p.workoutReminderLeadMinutes} minutes before planned sessions that have a time.`}
          value={p.workoutRemindersEnabled}
          onChange={toggleReminders}
        />
        {permissionNote ? <Banner tone="warning">{permissionNote}</Banner> : null}
      </Section>

      <Section title="Account">
        {isAnonymous ? (
          <Text variant="small" color="inkSecondary">
            This workspace is private to this browser or device and isn't linked to an email address. Clearing your browser data or
            signing in elsewhere won't bring it back.
          </Text>
        ) : (
          <Button label="Sign out" variant="danger" onPress={() => signOut().then(() => router.replace('/'))} />
        )}
        <Button label="Sign in to an existing account" variant="ghost" onPress={() => router.push('/sign-in')} />
      </Section>
    </Screen>
  );
}
