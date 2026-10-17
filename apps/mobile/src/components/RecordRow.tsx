import type { PersonalRecord } from '@mova/shared';
import { formatDate } from '@/lib/format';
import { Card, Row } from './Layout';
import { Text } from './Text';

const LABELS: Record<PersonalRecord['type'], string> = {
  heaviest_weight: 'Heaviest set',
  most_reps: 'Most reps in a set',
  best_set_volume: 'Best set (weight × reps)',
};

export function RecordRow({ record: r }: { record: PersonalRecord }) {
  const value =
    r.type === 'most_reps' ? `${r.value} reps` : r.type === 'heaviest_weight' ? `${r.value} ${r.unit} × ${r.reps}` : `${Math.round(r.value)} ${r.unit}·reps`;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="small" color="inkSecondary">
          {LABELS[r.type]}
        </Text>
        <Text variant="caption" color="inkTertiary">
          {formatDate(r.achievedOn)}
        </Text>
      </Row>
      <Text variant="bodyStrong">{value}</Text>
    </Card>
  );
}

