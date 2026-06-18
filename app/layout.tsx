import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vending App',
  description: 'สแกน QR ซื้อสินค้าจากตู้',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">

      <body className="bg-gray-50 min-h-screen">
        <div className="max-w-md mx-auto min-h-screen bg-white shadow-sm">
          {children}
        </div>
      </body>
    </html>
  )
}