import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'Missing ticker parameter' }, { status: 400 });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo Finance returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      return NextResponse.json({ error: 'No data found for ticker' }, { status: 404 });
    }

    const meta = result.meta;
    const price = meta?.regularMarketPrice ?? null;

    return NextResponse.json({ ticker: meta.symbol, price });
  } catch (error) {
    console.error('Yahoo Finance fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
  }
}
