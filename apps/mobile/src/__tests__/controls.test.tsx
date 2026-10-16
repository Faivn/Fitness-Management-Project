import { fireEvent, render, screen } from '@testing-library/react-native';
import { DateRangeHeader, ExpandableCard, IconButton, UnderlineTabs } from '@/components';
import { Text } from '@/components';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }));

describe('ExpandableCard', () => {
  it('is collapsed by default, announces its state and toggles', async () => {
    await render(
      <ExpandableCard title="Needs an update" summary="2 sessions">
        <Text>hidden detail</Text>
      </ExpandableCard>,
    );
    const toggle = screen.getByRole('button', { name: /Needs an update/ });
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.queryByText('hidden detail')).toBeNull();
    await fireEvent.press(toggle);
    expect(screen.getByRole('button', { name: /Needs an update/ }).props.accessibilityState).toMatchObject({ expanded: true });
    expect(screen.getByText('hidden detail')).toBeTruthy();
  });
});

describe('UnderlineTabs', () => {
  it('marks the selected tab and reports changes', async () => {
    const onChange = jest.fn();
    await render(
      <UnderlineTabs
        tabs={[
          { key: 'a', label: 'Routines' },
          { key: 'b', label: 'Next two weeks' },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Routines' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('tab', { name: 'Next two weeks' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('DateRangeHeader and IconButton', () => {
  it('has labelled arrows that navigate', async () => {
    const prev = jest.fn();
    const next = jest.fn();
    await render(<DateRangeHeader label="12 Oct – 18 Oct" onPrevious={prev} onNext={next} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Previous week' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next week' }));
    expect(prev).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(screen.getByText('12 Oct – 18 Oct')).toBeTruthy();
  });

  it('exposes an accessible name for icon-only buttons', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="plus" label="Add water" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add water' }));
    expect(onPress).toHaveBeenCalled();
  });
});
