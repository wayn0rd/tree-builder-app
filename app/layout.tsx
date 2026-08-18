import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sector Watchlist',
  description: 'Tag-driven stock watchlist with live prices and daily change, grouped into sector cards',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
