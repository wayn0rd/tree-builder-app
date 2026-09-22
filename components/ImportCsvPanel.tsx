'use client';

// Import CSV panel — Cycle-3 spec .loopzai/spec.md D10 (preview then
// confirm), D15 (hooks; no heading, no `Add stock`, no borrowed id), D16
// (fixed strings). Purely presentational: the Manage Stocks modal owns the
// run state and every handler; this component renders one phase of it.

import {
  ImportCounts,
  ImportRow,
  confirmLabel,
  countOutcomes,
  importingLabel,
  lookingUpLabel,
  previewSummary,
  reportSummary,
} from '../lib/watchlistImport';

export type ImportPanelState =
  | {
      runId: number;
      phase: 'preview';
      error: string | null;
      plan: ImportRow[];
      pending: number;
    }
  | {
      runId: number;
      phase: 'applying';
      plan: ImportRow[];
      index: number;
      total: number;
    }
  | { runId: number; phase: 'report'; plan: ImportRow[] };

interface ImportCsvPanelProps {
  state: ImportPanelState;
  onCancel: () => void;
  onConfirm: () => void;
  onDone: () => void;
}

const BUTTON =
  'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50';
const PRIMARY =
  'rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700';

function outcomeClass(outcome: ImportRow['outcome']): string {
  switch (outcome) {
    case 'added':
      return 'text-green-700';
    case 'skipped':
      return 'text-gray-500';
    case 'rejected':
      return 'text-red-600';
    default:
      return 'text-red-700';
  }
}

export default function ImportCsvPanel({
  state,
  onCancel,
  onConfirm,
  onDone,
}: ImportCsvPanelProps) {
  const fileError = state.phase === 'preview' ? state.error : null;
  const counts: ImportCounts = countOutcomes(state.plan);
  const pending = state.phase === 'preview' ? state.pending : 0;
  const summary =
    state.phase === 'report' ? reportSummary(counts) : previewSummary(counts);

  return (
    <div
      data-testid="manage-stocks-import-panel"
      data-phase={state.phase}
      className="py-3"
    >
      {fileError !== null ? (
        <p
          data-testid="manage-stocks-import-error"
          className="py-6 text-center text-sm text-red-600"
        >
          {fileError}
        </p>
      ) : (
        <>
          {state.phase === 'preview' && pending > 0 && (
            <p className="mb-2 text-sm text-gray-500">{lookingUpLabel(pending)}</p>
          )}
          {state.phase === 'applying' && (
            <p className="mb-2 text-sm text-gray-500">
              {importingLabel(state.index, state.total)}
            </p>
          )}
          <p
            data-testid="manage-stocks-import-summary"
            className="mb-2 text-sm font-semibold text-gray-900"
          >
            {summary}
          </p>
          <ul className="divide-y divide-gray-100">
            {state.plan.map((r) => (
              <li
                key={r.row}
                data-testid="manage-stocks-import-row"
                data-row={r.row}
                data-ticker={r.ticker}
                data-outcome={r.outcome}
                className="flex flex-wrap items-baseline gap-x-3 py-2 text-sm"
              >
                <span className="w-8 shrink-0 text-right text-gray-400">{r.row}</span>
                <span className="w-24 shrink-0 font-bold text-gray-900">{r.ticker}</span>
                <span className={`w-16 shrink-0 font-medium ${outcomeClass(r.outcome)}`}>
                  {r.outcome}
                </span>
                <span className="min-w-0 flex-1 text-gray-700">
                  {r.reason !== null && <span>{r.reason}</span>}
                  {r.reason !== null && r.name !== null && <span> — </span>}
                  {r.name !== null && <span>{r.name}</span>}
                  {r.note !== null && (
                    <span className="text-gray-500"> · {r.note}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {state.phase === 'preview' && (
          <>
            <button
              data-testid="manage-stocks-import-cancel"
              type="button"
              onClick={onCancel}
              className={BUTTON}
            >
              Cancel
            </button>
            {fileError === null && pending === 0 && counts.added > 0 && (
              <button
                data-testid="manage-stocks-import-confirm"
                type="button"
                onClick={onConfirm}
                className={PRIMARY}
              >
                {confirmLabel(counts.added)}
              </button>
            )}
          </>
        )}
        {state.phase === 'report' && (
          <button
            data-testid="manage-stocks-import-done"
            type="button"
            onClick={onDone}
            className={PRIMARY}
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
