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
