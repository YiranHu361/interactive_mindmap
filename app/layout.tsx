import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'Interactive Mind Map',
  description: 'Explore careers and skills interactively',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  )
}


