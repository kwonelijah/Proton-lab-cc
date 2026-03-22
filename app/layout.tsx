import type { Metadata } from 'next'
import { Playfair_Display, Montserrat } from 'next/font/google'
import '@/styles/globals.css'
import CartDrawer from '@/components/ui/CartDrawer'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const inter = Montserrat({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s | Proton Lab CC',
    default: 'Proton Lab CC — Premium Cycling Apparel',
  },
  description:
    'Precision-engineered cycling apparel for those who train and race without compromise. Aero, Endurance, and Training series.',
  openGraph: {
    siteName: 'Proton Lab CC',
    type: 'website',
    locale: 'en_GB',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="bg-proton-white text-proton-black font-inter antialiased">
        {children}
        <CartDrawer />
      </body>
    </html>
  )
}
