import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hierarchical Tree Builder',
  description: 'Create hierarchical trees with text labels and live stock prices',
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
