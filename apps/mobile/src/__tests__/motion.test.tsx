import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { Appear, Text, ThinkingIndicator } from '@/components';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('motion primitives', () => {
  afterEach(() => jest.restoreAllMocks());

  it('ThinkingIndicator exposes its meaning as text, not through the decorative dots', async () => {
    await render(<ThinkingIndicator />);
    expect(screen.getByLabelText('Thinking…')).toBeTruthy();
  });

  it('Appear always renders its content, animated or not', async () => {
    await render(
      <>
        <Appear>
          <Text>animated</Text>
        </Appear>
        <Appear enabled={false}>
          <Text>static</Text>
        </Appear>
      </>,
    );
    expect(screen.getByText('animated')).toBeTruthy();
    expect(screen.getByText('static')).toBeTruthy();
  });

  it('renders in place when the user prefers reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(
      <Appear variant="card">
        <Text>card</Text>
      </Appear>,
    );
    expect(screen.getByText('card')).toBeTruthy();
    await render(<ThinkingIndicator />);
    expect(screen.getAllByLabelText('Thinking…').length).toBeGreaterThan(0);
  });
});
