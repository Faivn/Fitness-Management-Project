/// <reference types="jest" />
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import type { RoutinePlan, WorkoutSession } from '@mova/shared';
import { routinePlanSchema } from '@mova/shared';
import { NumberField, StatusBadge } from '@/components';
import { ConflictList, ProposalBanner, SessionCard } from '@/components/domain';
import { emptyPlan, RoutineEditor } from '@/components/RoutineEditor';
import { validate } from '@/lib/validation';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }));

const base: WorkoutSession = {
  id: 's1',
  title: 'Upper body',
  activityType: 'strength',
  source: 'ai',
  status: 'scheduled',
  routineId: 'r1',
  routineVersionId: 'v1',
  originalPlannedDate: '2026-10-19',
  plannedDate: '2026-10-20',
  plannedTime: '07:00',
  plannedDurationMinutes: 60,
  plannedTimezone: 'Africa/Lagos',
  actualStartAt: null,
  actualEndAt: null,
  actualDate: null,
  actualDurationSeconds: null,
  actualDistanceValue: null,
  actualDistanceUnit: null,
  notes: null,
  createdAt: '',
  updatedAt: '',
};

describe('status is never colour alone', () => {
  it('labels each status with text', async () => {
    await render(<StatusBadge status="missed" />);
    expect(screen.getByText('Missed')).toBeTruthy();
    expect(screen.getByLabelText('Status: Missed')).toBeTruthy();
  });
});

describe('SessionCard separates plan from reality', () => {
  it('shows a planned, moved session without any recorded result', async () => {
    await render(<SessionCard session={base} />);
    expect(screen.getByText(/Planned · 07:00 · 60 min · moved from Mon 19 Oct/)).toBeTruthy();
    expect(screen.queryByText('Recorded')).toBeNull();
    expect(screen.getByText('Planned')).toBeTruthy(); // status badge
  });

  it('shows recorded values only when an actual date exists', async () => {
    await render(<SessionCard session={{ ...base, status: 'completed', actualDate: '2026-10-21', actualDurationSeconds: 3300 }} />);
    expect(screen.getByText('Recorded')).toBeTruthy();
    expect(screen.getByText(/Wed 21 Oct · 55 min/)).toBeTruthy();
  });

  it('marks unplanned activity without inventing a plan', async () => {
    await render(<SessionCard session={{ ...base, source: 'historical_entry', status: 'completed', originalPlannedDate: null, plannedDate: null, actualDate: '2026-10-10' }} />);
    expect(screen.getByText(/Unplanned/)).toBeTruthy();
    expect(screen.queryByText(/^Planned ·/)).toBeNull();
    expect(screen.getByText('Added later')).toBeTruthy();
  });
});

describe('NumberField keeps unknown values unknown', () => {
  function Harness({ onValue }: { onValue: (v: number | undefined) => void }) {
    const [v, setV] = useState<number | undefined>(undefined);
    return (
      <NumberField
        label="Distance"
        value={v}
        onChange={(n) => {
          setV(n);
          onValue(n);
        }}
      />
    );
  }

  it('reports undefined, not zero, when cleared', async () => {
    const seen: Array<number | undefined> = [];
    await render(<Harness onValue={(v) => seen.push(v)} />);
    const input = screen.getByLabelText('Distance');
    expect(input.props.placeholder).toBe('Not recorded');
    await fireEvent.changeText(input, '5,5');
    await fireEvent.changeText(input, '');
    expect(seen).toEqual([5.5, undefined]);
  });
});

describe('proposals and conflicts are explicit', () => {
  it('labels a draft as not saved', async () => {
    await render(<ProposalBanner version={3} status="draft" />);
    expect(screen.getByText('Proposal — not saved yet')).toBeTruthy();
    expect(screen.queryByText('v3')).toBeNull();
  });

  it('describes each conflict in words', async () => {
    await render(
      <ConflictList
        conflicts={[
          {
            kind: 'overlap',
            proposed: { title: 'Lower body', plannedDate: '2026-10-16', plannedTime: '18:00', durationMinutes: 60 },
            existing: { title: 'Evening ride', plannedDate: '2026-10-16', plannedTime: '18:30', durationMinutes: 45 },
          },
        ]}
      />,
    );
    expect(screen.getByText('1 scheduling conflict')).toBeTruthy();
    expect(screen.getByText(/"Lower body" overlaps "Evening ride" at 18:30/)).toBeTruthy();
  });
});

describe('RoutineEditor uses the shared routine schema', () => {
  function Editor({ onPlan }: { onPlan: (p: RoutinePlan) => void }) {
    const [plan, setPlan] = useState(emptyPlan());
    return (
      <RoutineEditor
        plan={plan}
        onChange={(p) => {
          setPlan(p);
          onPlan(p);
        }}
        errors={{}}
        weightUnit="kg"
      />
    );
  }

  it('builds a plan that passes the same validation the API applies', async () => {
    let latest: RoutinePlan = emptyPlan();
    await render(<Editor onPlan={(p) => (latest = p)} />);
    expect(validate(routinePlanSchema, latest).ok).toBe(false);

    await fireEvent.changeText(screen.getByLabelText('Routine name'), 'Push day');
    await fireEvent.changeText(screen.getByLabelText('Session name'), 'Push');
    await fireEvent.press(screen.getByLabelText('Add exercise'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Bench press');

    const result = validate(routinePlanSchema, latest);
    expect(result.ok).toBe(true);
  });
});
