import type { Metadata } from 'next'
import './globals.css'
import ConvexClientProvider from './ConvexClientProvider'

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
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  )
}
