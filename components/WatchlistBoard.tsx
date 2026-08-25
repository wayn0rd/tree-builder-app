'use client';

// The sector-card board shared by the owner dashboard and the read-only
// shared page — spec D11 (Cycle-1 parity) and U6/D8 (`?tags=` sync works
// identically on `/` and `/shared/<token>`). Omitting onEdit/onDelete
// renders the read-only variant (no edit/delete buttons).

import { useEffect, useRef, useState } from 'react';
import SectorCard from './SectorCard';
import TagFilterBar from './TagFilterBar';
import { Quote } from '../lib/quotes';
import { Stock, distinctTags } from '../lib/watchlist';

interface WatchlistBoardProps {
  stocks: Stock[];
  quotes: Record<string, Quote | undefined>;
  onEdit?: (stock: Stock) => void;
  onDelete?: (stock: Stock) => void;
  /** Owner view shows the empty-state card; the shared page does not. */
  showEmptyState?: boolean;
}

export default function WatchlistBoard({
  stocks,
  quotes,
  onEdit,
  onDelete,
  showEmptyState = false,
}: WatchlistBoardProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const didInit = useRef(false);

  // D11/U6: initial selection from the ?tags= URL param (unknown values
  // stay in the URL while matching no cards).
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const tagsParam = new URLSearchParams(window.location.search).get('tags');
    if (tagsParam) {
      setSelectedTags(
        tagsParam
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      );
    }
  }, []);

  /** Selection ↔ ?tags=<comma-joined, URI-encoded tag names>. */
  function applySelection(next: string[]) {
    setSelectedTags(next);
    const url =
      next.length > 0
        ? `${window.location.pathname}?tags=${next
            .map(encodeURIComponent)
            .join(',')}`
        : window.location.pathname;
    window.history.replaceState(null, '', url);
  }

  function toggleTag(tag: string) {
    const lower = tag.toLowerCase();
    const isSelected = selectedTags.some((t) => t.toLowerCase() === lower);
    applySelection(
      isSelected
        ? selectedTags.filter((t) => t.toLowerCase() !== lower)
        : [...selectedTags, tag]
    );
  }

  const allTags = distinctTags(stocks);
  const selectedLower = new Set(selectedTags.map((t) => t.toLowerCase()));
  const visibleTags =
    selectedTags.length === 0
      ? allTags
      : allTags.filter((t) => selectedLower.has(t.toLowerCase()));

  return (
    <>
      <TagFilterBar
        tags={allTags}
        selected={selectedTags}
        onToggle={toggleTag}
        onClear={() => applySelection([])}
      />

      {stocks.length === 0 && showEmptyState ? (
        <div
          data-testid="empty-state"
          className="rounded-xl border-2 border-dashed border-gray-300 bg-white px-6 py-16 text-center"
        >
          <p className="mb-1 text-lg font-medium text-gray-700">
            Your watchlist is empty
          </p>
          <p className="text-sm text-gray-500">
            Click &ldquo;+ Add stock&rdquo; to add your first ticker.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleTags.map((tag) => (
            <SectorCard
              key={tag}
              tag={tag}
              stocks={stocks.filter((s) =>
                s.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
              )}
              quotes={quotes}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </>
  );
}
