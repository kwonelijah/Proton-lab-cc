import Link from 'next/link'

const shopLinks = [
  { label: 'Collections', href: '/collections' },
  { label: 'Aero Series', href: '/collections/aero-series' },
  { label: 'Endurance Series', href: '/collections/endurance-series' },
  { label: 'Training Series', href: '/collections/training-series' },
]

const brandLinks = [
  { label: 'About', href: '/about' },
  { label: 'Team', href: '/team' },
  { label: 'Journal', href: '/journal' },
  { label: 'Contact', href: '/contact' },
]

export default function Footer() {
  return (
    <footer className="bg-proton-black text-proton-white">
      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-20 pb-10">
        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 pb-16 border-b border-proton-grey/20">
          {/* Brand */}
          <div>
            <p className="font-inter text-xs uppercase tracking-widest text-proton-white mb-4">
              Proton Lab CC
            </p>
            <p className="font-playfair text-2xl leading-snug text-proton-white/80 max-w-xs">
              No compromise.<br />No colour.
            </p>
            <p className="text-xs text-proton-grey mt-4 leading-relaxed">
              Premium cycling apparel engineered for those who train and race without limits.
            </p>
          </div>

          {/* Shop links */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-5">Shop</p>
            <ul className="space-y-3">
              {shopLinks.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-proton-white/70 hover:text-proton-white transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Brand links + Social */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-5">Brand</p>
            <ul className="space-y-3 mb-10">
              {brandLinks.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-proton-white/70 hover:text-proton-white transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-4">Follow</p>
            <div className="flex gap-4">
              {/* Instagram */}
              <a
                href="#"
                aria-label="Instagram"
                className="text-proton-white/50 hover:text-proton-white transition-colors duration-200"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              {/* Strava */}
              <a
                href="#"
                aria-label="Strava"
                className="text-proton-white/50 hover:text-proton-white transition-colors duration-200"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-8 gap-4">
          <p className="text-[10px] text-proton-grey uppercase tracking-widest">
            © {new Date().getFullYear()} Proton Lab CC. All rights reserved. Engineered in the UK.
          </p>
          <div className="flex gap-6">
            <Link href="#" className="text-[10px] text-proton-grey uppercase tracking-widest hover:text-proton-white transition-colors duration-200">
              Privacy Policy
            </Link>
            <Link href="#" className="text-[10px] text-proton-grey uppercase tracking-widest hover:text-proton-white transition-colors duration-200">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
