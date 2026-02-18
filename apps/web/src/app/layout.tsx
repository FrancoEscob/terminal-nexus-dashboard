import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AppPresenceTracker } from '@/components/AppPresenceTracker'
import './globals.css'
import '@/lib/backend-init' // Initialize backend

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Terminal Nexus Dashboard',
  description: 'A web-based terminal management dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppPresenceTracker />
        {children}
      </body>
    </html>
  )
}
