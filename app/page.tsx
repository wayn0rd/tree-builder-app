'use client';

// Sector Watchlist — Cycle-2 spec .loopzai/spec.md:
// D2 (login is the front door), U1–U3 (sign-in screen, not-invited wall,
// signed-in header), D11 (Cycle-1 UX parity on Convex storage), F2–F4.

import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import NotInvitedWall from '../components/NotInvitedWall';
import SignInScreen from '../components/SignInScreen';
import StockForm from '../components/StockForm';
import WatchlistBoard from '../components/WatchlistBoard';
import { Stock } from '../lib/watchlist';
import { formatRefreshTime, useQuotes } from '../lib/useQuotes';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <p className="text-sm text-gray-400">Loading…</p>
    </div>
  );
}

export default function Home() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me);

  // Brief loading indicator while auth state resolves (§4 preamble).
  if (isLoading || (isAuthenticated && me === undefined)) {
    return <LoadingScreen />;
  }
  if (!isAuthenticated || me === null || me === undefined) {
    return <SignInScreen />; // U1/D2: no watchlist UI, no data fetches
  }
  if (!me.isWhitelisted) {
    return <NotInvitedWall email={me.email} />; // U2/D4
  }
  return <Dashboard email={me.email} isAdmin={me.isAdmin} />;
}

function Dashboard({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const { signOut } = useAuthActions();
  const stockDocs = useQuery(api.stocks.list);
  const addStock = useMutation(api.stocks.add);
  const updateStock = useMutation(api.stocks.update);
  const removeStock = useMutation(api.stocks.remove);

  const { quotes, lastRefreshed, refreshing, refreshAll, fetchOne } =
    useQuotes();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Stock | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Stock | null>(null);
  const didInitQuotes = useRef(false);

  // null = server list still loading (R5: no flash of empty-state).
  const stocks: Stock[] | null = stockDocs
    ? stockDocs.map((d) => ({
        id: d._id,
        ticker: d.ticker,
        name: d.name,
        tags: d.tags,
      }))
    : null;

  // D11: quotes fetched on page load only (plus the manual button) — no
  // polling.
  useEffect(() => {
    if (stocks === null || didInitQuotes.current) return;
    didInitQuotes.current = true;
    if (stocks.length > 0) {
      void refreshAll(stocks.map((s) => s.ticker));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockDocs]);

  async function handleSave(data: Omit<Stock, 'id'>) {
    if (editing) {
      await updateStock({ id: editing.id as Id<'stocks'>, ...data });
    } else {
      await addStock(data);
    }
    setFormOpen(false);
    setEditing(null);
    if (!quotes[data.ticker]) {
      void fetchOne(data.ticker);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    await removeStock({ id: pendingDelete.id as Id<'stocks'> });
    setPendingDelete(null);
  }

  if (stocks === null) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Sector Watchlist
            </h1>
            <span data-testid="user-email" className="text-xs text-gray-500">
              {email}
            </span>
            {isAdmin && (
              <a
                data-testid="admin-link"
                href="/admin"
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Admin
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span data-testid="last-refreshed" className="text-xs text-gray-500">
              {lastRefreshed
                ? `Last refreshed: ${formatRefreshTime(lastRefreshed)}`
                : 'Not refreshed yet'}
            </span>
            <button
              data-testid="refresh-prices"
              type="button"
              onClick={() => void refreshAll(stocks.map((s) => s.ticker))}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {refreshing ? 'Refreshing…' : 'Refresh prices'}
            </button>
            <button
              data-testid="add-stock-button"
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Add stock
            </button>
            <button
              data-testid="signout-button"
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </header>

        <WatchlistBoard
          stocks={stocks}
          quotes={quotes}
          showEmptyState
          onEdit={(stock) => {
            setEditing(stock);
            setFormOpen(true);
          }}
          onDelete={(stock) => setPendingDelete(stock)}
        />

        {formOpen && (
          <StockForm
            initial={editing}
            stocks={stocks}
            onSave={handleSave}
            onClose={() => {
              setFormOpen(false);
              setEditing(null);
            }}
          />
        )}

        {pendingDelete && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setPendingDelete(null);
            }}
          >
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
              <p className="mb-4 text-sm text-gray-800">
                Delete{' '}
                <span className="font-semibold">{pendingDelete.ticker}</span>{' '}
                ({pendingDelete.name}) from the watchlist?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  data-testid="confirm-delete"
                  type="button"
                  onClick={() => void handleConfirmDelete()}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
