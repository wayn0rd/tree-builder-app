// Client-side quote fetching against our own /api/stock route.
// Spec: .loopzai/spec.md U4/U6 — a failed fetch degrades to nulls
// (rendered as "—" / data-direction="unavailable") without throwing.

export interface Quote {
  price: number | null;
  changePercent: number | null;
}

export const UNAVAILABLE_QUOTE: Quote = { price: null, changePercent: null };

export async function fetchQuote(ticker: string): Promise<Quote> {
  try {
    const res = await fetch(`/api/stock?ticker=${encodeURIComponent(ticker)}`);
    if (!res.ok) return UNAVAILABLE_QUOTE;
    const data = await res.json();
    return {
      price: typeof data.price === 'number' ? data.price : null,
      changePercent:
        typeof data.changePercent === 'number' ? data.changePercent : null,
    };
  } catch {
    return UNAVAILABLE_QUOTE;
  }
}

// Cycle 1 (autofill): company-name lookup for the Add-stock form, over the
// same /api/stock route. Spec D3 — the dot-class retry (`BRK.B` → `BRK-B`)
// lives here, not in the route. Never throws; a miss resolves to null.
// The caller passes an already-normalized ticker (trimmed, upper-cased).

interface NameLookup {
  ok: boolean;
  name: string | null;
}

async function requestName(ticker: string): Promise<NameLookup> {
  try {
    const res = await fetch(`/api/stock?ticker=${encodeURIComponent(ticker)}`);
    if (!res.ok) return { ok: false, name: null };
    const data = await res.json();
    const name =
      typeof data?.name === 'string' && data.name.trim() !== '' ? data.name : null;
    return { ok: true, name };
  } catch {
    return { ok: false, name: null };
  }
}

export async function fetchCompanyName(ticker: string): Promise<string | null> {
  const first = await requestName(ticker);
  // A 200 (even with name: null) or a non-dot ticker: exactly one request.
  if (first.ok || !ticker.includes('.')) return first.name;
  // Dot-class ticker that did not return 200: retry once with `.` → `-`.
  const retry = await requestName(ticker.replace(/\./g, '-'));
  return retry.name;
}
