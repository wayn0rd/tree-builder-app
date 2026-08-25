'use client';

// Not-invited wall — spec U2/D4: what an authenticated, non-whitelisted
// user sees at `/`. No watchlist UI, no data.

import { useAuthActions } from '@convex-dev/auth/react';

export default function NotInvitedWall({ email }: { email: string }) {
  const { signOut } = useAuthActions();
  return (
    <div
      data-testid="not-invited"
      className="flex min-h-screen items-center justify-center bg-gray-100 p-4"
    >
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-gray-900">
          You&rsquo;re not on the invite list
        </h1>
        <p className="mb-1 text-sm text-gray-500">
          Sector Watchlist is invite-only. Ask the admin to invite you.
        </p>
        <p className="mb-6 text-sm font-medium text-gray-700">{email}</p>
        <button
          data-testid="signout-button"
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
