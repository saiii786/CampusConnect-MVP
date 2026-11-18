import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/lib/api/api-error';
import { authApi } from '@/lib/auth/auth-api';
import { session } from '@/lib/auth/session';
// Screen tests live outside src/app/ because every file in src/app/ becomes a route.
import SignInScreen from '@/app/(auth)/sign-in';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { push: jest.fn(), replace: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('@/lib/auth/auth-api', () => ({ authApi: { login: jest.fn() } }));

const login = authApi.login as jest.Mock;

// The first render of a screen loads a lot of modules; on a cold cache that can exceed 5 s.
jest.setTimeout(30_000);

describe('Sign in screen', () => {
  beforeEach(() => {
    login.mockReset();
    jest.spyOn(session, 'signIn').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the shared-schema validation messages without calling the server', async () => {
    await render(<SignInScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
    expect(screen.getByText('Password is required')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('sends the normalised email and starts the session', async () => {
    const response = { user: {}, tokens: {} };
    login.mockResolvedValue(response);
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), '  Priya@Example.COM ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret-pass');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(session.signIn).toHaveBeenCalledWith(response));
    expect(login).toHaveBeenCalledWith({ email: 'priya@example.com', password: 'secret-pass' });
  });

  it('shows the server error for wrong credentials', async () => {
    login.mockRejectedValue(new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect'));
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.co');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email or password is incorrect')).toBeTruthy();
    expect(session.signIn).not.toHaveBeenCalled();
  });
});
