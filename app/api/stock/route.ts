import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const interval = request.nextUrl.searchParams.get('interval') || 'day';

  if (!ticker) {
    return NextResponse.json({ error: 'Missing ticker parameter' }, { status: 400 });
  }

  // Map interval to Yahoo Finance range parameter
  const rangeMap: Record<string, string> = {
    day: '1d',
    week: '5d',
    month: '1mo',
    ytd: 'ytd',
    year: '1y',
  };
  const range = rangeMap[interval] || '1d';

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`;
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
    const currentPrice = meta?.regularMarketPrice ?? null;

    // Get historical price from the beginning of the range
    const closePrices = result.indicators?.quote?.[0]?.close;
    let historicalPrice = null;

    if (closePrices && closePrices.length > 0) {
      // Find the first non-null close price in the array
      for (let i = 0; i < closePrices.length; i++) {
        if (closePrices[i] != null) {
          historicalPrice = closePrices[i];
          break;
        }
      }
    }

    return NextResponse.json({
      ticker: meta.symbol,
      price: currentPrice,
      historicalPrice: historicalPrice
    });
  } catch (error) {
    console.error('Yahoo Finance fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
  }
}
