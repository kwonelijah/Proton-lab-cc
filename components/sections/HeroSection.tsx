import Image from 'next/image'
import Button from '@/components/ui/Button'

interface HeroSectionProps {
  headline: string
  subheadline?: string
  ctaText: string
  ctaHref: string
  imageSrc: string
  imageAlt?: string
  eyebrow?: string
}

export default function HeroSection({
  headline,
  subheadline,
  ctaText,
  ctaHref,
  imageSrc,
  imageAlt = '',
  eyebrow,
}: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex items-end overflow-hidden">
      {/* Background image */}
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        sizes="100vw"
        className="object-cover"
        priority
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-proton-black/80 via-proton-black/20 to-transparent" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 pb-16 md:pb-24">
        {eyebrow && (
          <p className="text-[10px] text-proton-white/60 uppercase tracking-widest mb-6">
            {eyebrow}
          </p>
        )}
        <h1 className="font-playfair text-proton-white text-6xl md:text-8xl lg:text-9xl leading-none max-w-4xl">
          {headline}
        </h1>
        {subheadline && (
          <p className="text-proton-white/70 text-base md:text-lg mt-6 max-w-lg leading-relaxed">
            {subheadline}
          </p>
        )}
        <div className="mt-8 md:mt-10">
          <Button
            href={ctaHref}
            variant="secondary"
            size="lg"
            className="border-proton-white text-proton-white hover:bg-proton-white hover:text-proton-black"
          >
            {ctaText}
          </Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 right-8 md:right-12 flex flex-col items-center gap-2 opacity-50">
        <span className="text-proton-white text-[10px] uppercase tracking-widest rotate-90 origin-center translate-y-4">
          Scroll
        </span>
        <div className="w-px h-12 bg-proton-white/50" />
      </div>
    </section>
  )
}
