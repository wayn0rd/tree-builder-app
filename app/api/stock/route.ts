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
    // D1/A2: previous regular-session close, with chartPreviousClose fallback.
    const previousClose = meta?.previousClose ?? meta?.chartPreviousClose ?? null;
    // A3: unrounded daily % change; null when inputs are missing or previousClose is 0.
    const changePercent =
      currentPrice != null && previousClose != null && previousClose !== 0
        ? ((currentPrice - previousClose) / previousClose) * 100
        : null;

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
      previousClose: previousClose,
      changePercent: changePercent,
      historicalPrice: historicalPrice
    });
  } catch (error) {
    console.error('Yahoo Finance fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
  }
}
