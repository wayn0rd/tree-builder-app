'use client';

// Tag filter chips — spec U5/D4. Selection state and URL sync live in the
// page; this component only renders chips and the clear button.

import { tagColor } from './SectorCard';

interface TagFilterBarProps {
  /** All distinct tags in the watchlist, already sorted. */
  tags: string[];
  /** Currently selected tags (empty = show all). */
  selected: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

export default function TagFilterBar({
  tags,
  selected,
  onToggle,
  onClear,
}: TagFilterBarProps) {
  if (tags.length === 0) return null;
  const selectedLower = new Set(selected.map((t) => t.toLowerCase()));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
        Filter:
      </span>
      {tags.map((tag) => {
        const isSelected = selectedLower.has(tag.toLowerCase());
        return (
          <button
            key={tag}
            data-testid="tag-chip"
            data-tag={tag}
            data-selected={isSelected ? 'true' : 'false'}
            type="button"
            onClick={() => onToggle(tag)}
            style={isSelected ? { backgroundColor: tagColor(tag) } : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              isSelected
                ? 'border-transparent text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tag}
          </button>
        );
      })}
      <button
        data-testid="clear-tag-filter"
        type="button"
        onClick={onClear}
        className="rounded-full px-2 py-1 text-xs font-medium text-gray-400 underline-offset-2 hover:text-gray-700 hover:underline"
      >
        Clear filter
      </button>
    </div>
  );
}
