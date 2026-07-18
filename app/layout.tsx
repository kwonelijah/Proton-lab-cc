import type { Metadata } from 'next'
import { Playfair_Display, Montserrat } from 'next/font/google'
import '@/styles/globals.css'
import CartDrawer from '@/components/ui/CartDrawer'
import MetaPixel from '@/components/analytics/MetaPixel'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

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
  metadataBase: new URL('https://protonlab.cc'),
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
    images: [
      {
        url: '/images/hero/Home.jpg',
        width: 2436,
        height: 1125,
        alt: 'Proton Lab CC — Premium Cycling Apparel',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
  },
  verification: {
    other: {
      'facebook-domain-verification': 'gn8dcdy3qghvkp7pcwkeo8bodbevmn',
    },
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
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-proton-white focus:text-proton-black focus:px-4 focus:py-2 focus:text-xs focus:uppercase focus:tracking-widest focus:outline-none focus:ring-2 focus:ring-proton-black"
        >
          Skip to content
        </a>
        {children}
        <CartDrawer />
        <MetaPixel />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
