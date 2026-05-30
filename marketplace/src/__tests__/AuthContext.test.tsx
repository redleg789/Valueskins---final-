import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ReactNode } from 'react';

const MOCK_ACCOUNT = {
  id: 42,
  email: 'test@valueskins.local',
  phone: null,
  email_verified: true,
  phone_verified: false,
  display_name: 'Test User',
  avatar_url: null,
  onboarding_stage: 'complete',
  preferences: [],
  modules: [
    { code: 'explorer', is_active: true },
    { code: 'host', is_active: false },
    { code: 'valueskin', is_active: true },
  ],
  totp_enabled: false,
  created_at: '2026-01-01T00:00:00Z',
  last_login_at: '2026-04-01T00:00:00Z',
};

function TestConsumer({ onMount }: { onMount?: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="loading">{auth.loading ? 'true' : 'false'}</div>
      <div data-testid="account-id">{auth.account?.id ?? 'null'}</div>
      <div data-testid="account-email">{auth.account?.email ?? 'null'}</div>
      <div data-testid="account-verified">{auth.account?.email_verified ? 'yes' : 'no'}</div>
      <div data-testid="has-module-explorer">{auth.hasModule('explorer') ? 'true' : 'false'}</div>
      <div data-testid="has-module-host">{auth.hasModule('host') ? 'true' : 'false'}</div>
      <div data-testid="has-module-nonexistent">{auth.hasModule('nonexistent') ? 'true' : 'false'}</div>
      <div data-testid="has-permission">{auth.hasPermission('any_permission') ? 'true' : 'false'}</div>
    </div>
  );
}

function renderProvider(children: ReactNode) {
  return render(<AuthProvider>{children}</AuthProvider>);
}

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function mockFetchResponse(status: number, data: unknown) {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
}

describe('AuthContext', () => {
  it('starts in loading state', () => {
    mockFetchResponse(200, MOCK_ACCOUNT);
    renderProvider(<TestConsumer />);
    expect(screen.getByTestId('loading').textContent).toBe('true');
  });

  it('loads account on mount', async () => {
    mockFetchResponse(200, MOCK_ACCOUNT);
    renderProvider(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('account-id').textContent).toBe('42');
    });
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('account-email').textContent).toBe('test@valueskins.local');
    expect(screen.getByTestId('account-verified').textContent).toBe('yes');
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', { credentials: 'include' });
  });

  it('sets null account on 401', async () => {
    mockFetchResponse(401, { error: 'Unauthorized' });
    renderProvider(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('account-id').textContent).toBe('null');
    });
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('sets null account on network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    renderProvider(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('account-id').textContent).toBe('null');
    });
  });

  describe('hasModule', () => {
    it('returns true for active modules', async () => {
      mockFetchResponse(200, MOCK_ACCOUNT);
      renderProvider(<TestConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('has-module-explorer').textContent).toBe('true');
      });
    });

    it('returns false for inactive modules', async () => {
      mockFetchResponse(200, MOCK_ACCOUNT);
      renderProvider(<TestConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('has-module-host').textContent).toBe('false');
      });
    });

    it('returns false for non-existent modules', async () => {
      mockFetchResponse(200, MOCK_ACCOUNT);
      renderProvider(<TestConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('has-module-nonexistent').textContent).toBe('false');
      });
    });
  });

  describe('hasPermission', () => {
    it('returns true for any permission', async () => {
      mockFetchResponse(200, MOCK_ACCOUNT);
      renderProvider(<TestConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('has-permission').textContent).toBe('true');
      });
    });
  });

  describe('useAuth throws outside provider', () => {
    it('throws when used outside AuthProvider', () => {
      expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within AuthProvider');
    });
  });
});
