'use client';

// Share management panel — spec U5/F6/D7: copy-on-create. The full share
// URL is revealed exactly once, at creation, in `share-created-url`; the
// persistent list shows only the shortened 8-char identifier + revoke.
// No element ever re-displays a full share URL after creation.

import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';

export default function SharePanel({ onClose }: { onClose: () => void }) {
  const links = useQuery(api.share.list);
  const createLink = useMutation(api.share.create);
  const revokeLink = useMutation(api.share.revoke);
  // The one-time plaintext URL (D7): exists only in this component's state,
  // only between creation and panel close.
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setCopied(false);
    try {
      const token = await createLink({});
      setCreatedUrl(`${window.location.origin}/shared/${token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create link.');
    }
  }

  async function handleCopy() {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
    } catch {
      // Clipboard unavailable — the URL is still visible to copy manually.
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="share-panel"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Share links</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share panel"
            className="rounded px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <p className="mb-3 text-xs text-gray-500">
          Anyone with a link can view a read-only copy of your watchlist — no
          sign-in needed. Revoking a link kills it immediately.
        </p>

        <button
          data-testid="share-create"
          type="button"
          onClick={() => void handleCreate()}
          className="mb-3 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create share link
        </button>
        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {createdUrl && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3">
            <p className="mb-1 text-xs font-medium text-amber-800">
              Copy this link now — it will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code
                data-testid="share-created-url"
                className="min-w-0 flex-1 break-all text-xs text-gray-800"
              >
                {createdUrl}
              </code>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-md border border-gray-200">
          {links === undefined ? (
            <p className="px-3 py-4 text-center text-xs text-gray-400">
              Loading…
            </p>
          ) : links.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-gray-500">
              No active share links.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {links.map((link) => (
                <li
                  key={link._id}
                  data-testid="share-link-row"
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="font-mono text-xs text-gray-700">
                    <span data-testid="share-link-id">{link.display}</span>…
                  </span>
                  <button
                    data-testid="share-revoke"
                    type="button"
                    onClick={() =>
                      void revokeLink({ id: link._id as Id<'shareLinks'> })
                    }
                    className="rounded px-2 py-1 text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
