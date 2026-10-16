import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const frame = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const withSafeArea = (ui: React.ReactElement) => <SafeAreaProvider initialMetrics={frame}>{ui}</SafeAreaProvider>;

const mockReplace = jest.fn();
const mockStartGuest = jest.fn();
let mockAuth: any = { session: null, isGuest: false, startGuest: mockStartGuest };

jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a), push: jest.fn() } }));
jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth }));
jest.mock('@react-native-async-storage/async-storage', () => ({ setItem: jest.fn(() => Promise.resolve()), getItem: jest.fn(() => Promise.resolve(null)) }));
jest.mock('@/lib/config', () => ({ ...jest.requireActual('@/lib/config'), sampleMode: false }));

import { GuestBanner } from '@/components/GuestBanner';
import Welcome from '@/app/welcome';

describe('guest demo entry', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockStartGuest.mockReset();
    mockAuth = { session: null, isGuest: false, startGuest: mockStartGuest };
  });

  it('starts a guest session on "Get started" with no sign-up, and says the data is temporary', async () => {
    mockStartGuest.mockResolvedValue(undefined);
    await render(<Welcome />);
    expect(screen.getByText(/No account needed/)).toBeTruthy();
    expect(screen.getByText(/deleted/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    await waitFor(() => expect(mockStartGuest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining('sign-in'));
  });

  it('shows a plain error and stays put if the demo cannot start', async () => {
    mockStartGuest.mockRejectedValue(new Error("The demo isn't available right now."));
    await render(<Welcome />);
    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    await waitFor(() => expect(screen.getByText("The demo isn't available right now.")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('keeps "I already have an account" for existing users', async () => {
    await render(<Welcome />);
    expect(screen.getByRole('button', { name: /already have an account/ })).toBeTruthy();
  });

  it('shows the temporary-workspace notice only to guests', async () => {
    mockAuth = { isGuest: true };
    await render(withSafeArea(<GuestBanner />));
    expect(screen.getByText(/Demo workspace/)).toBeTruthy();
    expect(screen.getByLabelText(/deleted|erase/i)).toBeTruthy();
  });

  it('renders nothing for registered users', async () => {
    mockAuth = { isGuest: false };
    await render(withSafeArea(<GuestBanner />));
    expect(screen.queryByText(/Demo workspace/)).toBeNull();
  });
});
