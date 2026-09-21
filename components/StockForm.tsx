'use client';

// Add/edit stock modal — spec U1/U2, validation per S2.
// Tag entry: Enter commits the current text as a chip; pending text is also
// counted as a candidate tag on save (see .loopzai/assumptions.md
// assumption-0001). Commas never split — they are a validation error.

import { useEffect, useRef, useState } from 'react';
import { Stock, validateStock } from '../lib/watchlist';
import { fetchCompanyName } from '../lib/quotes';

interface StockFormProps {
  /** Stock being edited, or null when adding. */
  initial: Stock | null;
  /** Current watchlist (duplicate-ticker check + tag suggestions). */
  stocks: Stock[];
  /** May reject (server-side F4 validation); the error is surfaced in
   *  stock-form-error and the form stays open. */
  onSave: (stock: Omit<Stock, 'id'>) => Promise<void>;
  onClose: () => void;
}

export default function StockForm({
  initial,
  stocks,
  onSave,
  onClose,
}: StockFormProps) {
  const [ticker, setTicker] = useState(initial?.ticker ?? '');
  // Cycle 1 autofill, spec D2: the name and its provenance are one fact —
  // `fromAutofill` is true only while the value is the untouched output of
  // the last lookup. Any user edit makes it human-authored for the life of
  // the form.
  const [nameState, setNameState] = useState<{
    value: string;
    fromAutofill: boolean;
  }>({ value: initial?.name ?? '', fromAutofill: false });
  const name = nameState.value;
  // D7: the stale-response guard reads the ticker field's *current* value at
  // write time, so it is mirrored in a ref the async handler can read.
  const tickerRef = useRef(ticker);
  const mountedRef = useRef(false);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cycle 1 autofill (spec D1, D3, D5–D9): on blur of the ticker field in
  // Add mode, look the ticker up and fill the Company name when allowed.
  async function handleTickerBlur(raw: string) {
    if (initial) return; // D5: Add only — Edit never looks up.
    const requested = raw.trim().toUpperCase(); // D9: normalized for the request only.
    if (!requested) return; // D8: blank ticker → no request.
    const found = await fetchCompanyName(requested); // D3: dot-class retry inside.
    if (!mountedRef.current) return;
    if (found === null) return; // D6: a miss never writes (and shows nothing, D10).
    if (tickerRef.current.trim().toUpperCase() !== requested) return; // D7: stale response.
    setNameState((prev) =>
      prev.value.trim() === '' || prev.fromAutofill
        ? { value: found, fromAutofill: true } // D2 write rule
        : prev
    );
  }

  const suggestions = Array.from(
    new Set(stocks.flatMap((s) => s.tags))
  ).filter((t) => !tags.some((mine) => mine.toLowerCase() === t.toLowerCase()));

  function commitTagInput() {
    const tag = tagInput.trim();
    if (!tag) return;
    if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Pending text in the tag input counts as one candidate tag (unsplit).
    const candidateTags = tagInput.trim()
      ? [...tags, tagInput]
      : tags;
    const result = validateStock(
      { ticker, name, tags: candidateTags },
      stocks,
      initial?.id ?? null
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      await onSave(result.stock);
    } catch (err) {
      // Server-side F4 rejection: surface it, do not save/close.
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        data-testid="stock-form"
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {initial ? `Edit ${initial.ticker}` : 'Add stock'}
        </h2>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Ticker
        </label>
        <input
          data-testid="stock-form-ticker"
          type="text"
          value={ticker}
          onChange={(e) => {
            tickerRef.current = e.target.value;
            setTicker(e.target.value);
          }}
          onBlur={(e) => void handleTickerBlur(e.currentTarget.value)}
          placeholder="e.g. AAPL"
          autoFocus
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Company name
        </label>
        <input
          data-testid="stock-form-name"
          type="text"
          value={name}
          onChange={(e) =>
            setNameState({ value: e.target.value, fromAutofill: false })
          }
          placeholder="e.g. Apple Inc."
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Tags <span className="font-normal text-gray-400">(press Enter to add each tag)</span>
        </label>
        {tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => removeTag(tag)}
                  className="text-blue-500 hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          data-testid="stock-form-tags"
          type="text"
          value={tagInput}
          list="stock-form-tag-suggestions"
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitTagInput();
            }
          }}
          placeholder="e.g. Tech"
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <datalist id="stock-form-tag-suggestions">
          {suggestions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

        {error && (
          <div
            data-testid="stock-form-error"
            role="alert"
            className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            data-testid="stock-form-save"
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
