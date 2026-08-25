'use client';

// Sign-in screen — spec U1/D2: the only thing an unauthenticated visitor
// sees. The test sign-in form (D10) renders ONLY when the build-time env
// var NEXT_PUBLIC_E2E_TEST_MODE=1 (T-S1 guard); production never sets it.

import { useAuthActions } from '@convex-dev/auth/react';
import { useState } from 'react';

export default function SignInScreen() {
  const { signIn } = useAuthActions();
  const [testEmail, setTestEmail] = useState('');
  const [testSecret, setTestSecret] = useState('');
  const [testError, setTestError] = useState<string | null>(null);

  async function handleTestSignIn(e: React.FormEvent) {
    e.preventDefault();
    setTestError(null);
    try {
      await signIn('test-login', { email: testEmail, secret: testSecret });
    } catch {
      setTestError('Test sign-in failed.');
    }
  }

  return (
    <div
      data-testid="signin-screen"
      className="flex min-h-screen items-center justify-center bg-gray-100 p-4"
    >
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Sector Watchlist
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Invite-only. Sign in to see your watchlist.
        </p>
        <button
          data-testid="signin-google"
          type="button"
          onClick={() => void signIn('google')}
          className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Sign in with Google
        </button>

        {process.env.NEXT_PUBLIC_E2E_TEST_MODE === '1' && (
          <form
            onSubmit={handleTestSignIn}
            className="mt-6 border-t border-dashed border-gray-300 pt-4 text-left"
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Test sign-in (E2E mode)
            </p>
            <input
              data-testid="test-signin-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="email"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <input
              data-testid="test-signin-secret"
              type="password"
              value={testSecret}
              onChange={(e) => setTestSecret(e.target.value)}
              placeholder="secret"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              data-testid="test-signin-submit"
              type="submit"
              className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Test sign in
            </button>
            {testError && (
              <p className="mt-2 text-xs text-red-600">{testError}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
