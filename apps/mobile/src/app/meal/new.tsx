import { router, Stack } from 'expo-router';
import { appToday } from '@/lib/today';
import { useState } from 'react';
import { View } from 'react-native';
import { addDays, isLocalDate } from '@mova/shared';
import { Appear, Banner, Button, ThinkingIndicator, Mascot, NumberField, Row, Screen, Text, TextField } from '@/components';
import { AIDisclaimer } from '@/components/domain';
import { useGenerateMealPlan, useProfile } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { useDraft } from '@/lib/drafts';

/** WF-10: describe goals and food preferences in your own words. */
export default function NewMealPlan() {
  const profile = useProfile();
  const today = appToday(profile.data?.timezone ?? 'UTC');
  const generate = useGenerateMealPlan();
  const draft = useDraft('meal-request', '');
  const [startDate, setStartDate] = useState(addDays(today, 1));
  const [days, setDays] = useState<number | undefined>(7);

  function submit() {
    generate.mutate(
      { request: draft.value, startDate, days: days ?? 7 },
      {
        onSuccess: (p) => {
          void draft.clear();
          router.replace(`/proposal/meal/${p.id}`);
        },
      },
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Plan meals with AI' }} />
      <Mascot mood="nutrition" size={96} />
      <Text variant="small" color="inkSecondary">
        Tell me your goal (e.g. a cutting phase), where you live or the cuisine you cook, foods you like or avoid, any allergies,
        budget and how many meals a day you want. You'll get a timetable and a shopping list to review. No calorie or macro tracking.
      </Text>
      <TextField
        label="Your request"
        placeholder="e.g. I'm in a cutting phase in Lagos. I like beans, plantain, fish and smoothies. No pork. Breakfast, lunch, afternoon snack and dinner."
        value={draft.value}
        onChangeText={draft.setValue}
        multiline
      />
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <TextField label="Start date" value={startDate} onChangeText={setStartDate} error={!isLocalDate(startDate) ? 'Use YYYY-MM-DD.' : undefined} />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label="Days" allowDecimal={false} value={days} onChange={setDays} helper="1–14" />
        </View>
      </Row>
      {generate.isError ? (
        <Appear>
          <Banner tone="error">{errorMessage(generate.error)}</Banner>
        </Appear>
      ) : null}
      {generate.isPending ? (
        <Appear>
          <ThinkingIndicator label="Drafting your meal plan" />
        </Appear>
      ) : null}
      <Button
        label="Draft my meal plan"
        variant="brand"
        fullWidth
        loading={generate.isPending}
        disabled={draft.value.trim().length < 5 || !isLocalDate(startDate) || !days || days < 1 || days > 14}
        onPress={submit}
      />
      <AIDisclaimer />
    </Screen>
  );
}
