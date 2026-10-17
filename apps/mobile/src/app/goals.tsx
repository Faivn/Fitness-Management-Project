import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Banner, Button, Card, EmptyState, ErrorState, IconButton, LoadingState, Row, RuneIcon, Screen, Section, SheetPage, Segmented, Text, TextField } from '@/components';
import { FieldToneContext } from '@/components/fieldTone';
import { MascotNote } from '@/components/domain';
import { colors, radii, spacing } from '@/theme/tokens';
import { useCreateGoal, useGoals, useUpdateGoal } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';

/** The goals list and add-goal dialog, reused by the Goals sheet and inside the Settings sheet. */
export function GoalsPanel({ addOpen, setAddOpen }: { addOpen: boolean; setAddOpen: (open: boolean) => void }) {
  const goals = useGoals();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [key, setKey] = useState(newIdempotencyKey);
  const open = addOpen;
  const setOpen = setAddOpen;

  if (goals.isPending) return <LoadingState />;
  if (goals.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(goals.error)} onRetry={() => goals.refetch()} />
      </Screen>
    );

  function submit() {
    create.mutate(
      { title: title.trim(), priority, isMeasurable: false, idempotencyKey: key },
      {
        onSuccess: () => {
          setTitle('');
          setPriority('medium');
          setKey(newIdempotencyKey());
          setOpen(false);
        },
      },
    );
  }

  return (
    <Screen>
      {goals.data.length > 0 && goals.data.every((g) => g.status === 'achieved') ? (
        <MascotNote mood="celebration">Every goal is achieved. Add a new one when you are ready.</MascotNote>
      ) : null}
      {goals.data.length === 0 ? (
        <EmptyState mood="focus" title="No goals yet" body="Tap + at the top to add one." />
      ) : (
        <Section>
          {goals.data.map((g) => {
            const achieved = g.status === 'achieved';
            return (
              <Card key={g.id}>
                <Row style={{ alignItems: 'flex-start', gap: spacing.md }}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: achieved }}
                    accessibilityLabel={achieved ? `${g.title}, achieved. Mark as active` : `Mark ${g.title} as achieved`}
                    onPress={() => update.mutate({ id: g.id, status: achieved ? 'active' : 'achieved' })}
                    hitSlop={8}
                    style={[styles.check, achieved && styles.checkOn]}
                  >
                    {achieved ? <RuneIcon name="check" size={16} color="onInk" /> : null}
                  </Pressable>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text variant="bodyStrong">{g.title}</Text>
                    <Text variant="small" color="inkSecondary">
                      {g.priority} priority · {g.source === 'ai' ? 'suggested by AI, approved by you' : 'added by you'}
                      {g.targetValue ? ` · target ${g.targetValue} ${g.targetUnit ?? ''}` : ''}
                      {g.targetDate ? ` by ${g.targetDate}` : ''}
                    </Text>
                  </View>
                  <IconButton icon="archive" label={`Archive ${g.title}`} variant="plain" size={32} onPress={() => update.mutate({ id: g.id, status: 'archived' })} />
                </Row>
              </Card>
            );
          })}
        </Section>
      )}
      {create.isError || update.isError ? <Banner tone="error">{errorMessage(create.error ?? update.error)}</Banner> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable accessible={false} style={styles.sheet} onPress={() => undefined}>
          <FieldToneContext.Provider value="well">
            <View style={styles.sheetHeader}>
              <Text variant="title" style={{ flex: 1 }}>
                Add a goal
              </Text>
              <IconButton icon="close" label="Cancel" variant="plain" onPress={() => setOpen(false)} />
            </View>
            <TextField label="Goal" value={title} onChangeText={setTitle} placeholder="e.g. Run 5 km without stopping" />
            <Segmented equal label="Priority" options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} value={priority} onChange={setPriority} />
            <Button label="Add goal" fullWidth disabled={!title.trim()} loading={create.isPending} onPress={submit} />
          </FieldToneContext.Provider>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkOn: { backgroundColor: colors.rose, borderColor: colors.rose },
  backdrop: { flex: 1, backgroundColor: 'rgba(42, 34, 48, 0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.base },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginRight: -spacing.sm },
  sheet: { width: '100%', maxWidth: 440, backgroundColor: colors.surface, borderRadius: radii.sheet, padding: spacing.lg, gap: spacing.lg },
});

/** Standalone Goals sheet (opened from a link); Settings embeds the same panel. */
export default function Goals() {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <SheetPage title="Goals" action={<IconButton icon="plus" label="Add a goal" variant="solid" onPress={() => setAddOpen(true)} />}>
      <GoalsPanel addOpen={addOpen} setAddOpen={setAddOpen} />
    </SheetPage>
  );
}
