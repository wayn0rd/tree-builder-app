'use client';

// Admin whitelist manager — spec U4/F5/D5: the admin manages the whitelist
// only (never other users' data). Any non-admin (or unauthenticated)
// visitor gets `admin-denied` and zero whitelist rows.

import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';

export default function AdminPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me);

  if (isLoading || (isAuthenticated && me === undefined)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }
  if (!me?.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <div
          data-testid="admin-denied"
          className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm"
        >
          <h1 className="mb-2 text-xl font-bold text-gray-900">
            Access denied
          </h1>
          <p className="mb-4 text-sm text-gray-500">
            This page is for the admin only.
          </p>
          <a href="/" className="text-sm font-medium text-blue-600 hover:underline">
            Back to the watchlist
          </a>
        </div>
      </div>
    );
  }
  return <WhitelistManager />;
}

function WhitelistManager() {
  const rows = useQuery(api.whitelist.list);
  const addEmail = useMutation(api.whitelist.add);
  const removeEmail = useMutation(api.whitelist.remove);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    try {
      await addEmail({ email });
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add email.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Invite list</h1>
          <a
            href="/"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to watchlist
          </a>
        </header>

        <form onSubmit={handleAdd} className="mb-4 flex gap-2">
          <input
            data-testid="whitelist-email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            data-testid="whitelist-add"
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Invite
          </button>
        </form>
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {rows === undefined ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              Loading…
            </p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              No invited emails yet. The admin account is always allowed.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((row) => (
                <li
                  key={row._id}
                  data-testid="whitelist-row"
                  data-email={row.email}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <span className="text-sm text-gray-800">{row.email}</span>
                  <button
                    data-testid="whitelist-remove"
                    type="button"
                    onClick={() => void removeEmail({ email: row.email })}
                    className="rounded px-2 py-1 text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
