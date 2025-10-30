import './globals.css'
import { ReactNode } from 'react'
import Providers from '@/components/Auth/Providers'
import AuthButtons from '@/components/Auth/AuthButtons'

export const metadata = {
  title: 'Interactive Mind Map',
  description: 'Explore careers and skills interactively',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <header className="h-12 border-b bg-white flex items-center justify-between px-4">
            <div className="font-medium">Interactive Mind Map</div>
            <AuthButtons />
          </header>
          {children}
        </Providers>
      </body>
    </html>
  )
}


