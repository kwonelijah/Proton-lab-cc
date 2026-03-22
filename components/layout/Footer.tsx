import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="bg-proton-black text-proton-white">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 flex flex-col items-center text-center gap-10">

        {/* Logo */}
        <Image
          src="/PLlogo2.png"
          alt="Proton Lab CC"
          width={80}
          height={80}
          className="h-14 w-auto"
        />

        {/* Nav links */}
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-proton-white/60">
          <Link href="/shop" className="hover:text-proton-white transition-colors duration-200">Shop</Link>
          <span>|</span>
          <Link href="/custom" className="hover:text-proton-white transition-colors duration-200">Custom</Link>
          <span>|</span>
<Link href="/contact" className="hover:text-proton-white transition-colors duration-200">Contact</Link>
          <span>|</span>
          <a
            href="https://www.instagram.com/protonlabcc/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-proton-white transition-colors duration-200"
          >
            Instagram
          </a>
        </div>

        {/* Copyright */}
        <p className="text-[10px] text-proton-grey uppercase tracking-widest">
          © {new Date().getFullYear()} Proton Sports Management Ltd. All rights reserved. Registered in the UK.
        </p>

      </div>
    </footer>
  )
}
