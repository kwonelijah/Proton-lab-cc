import Image from 'next/image'
import Button from '@/components/ui/Button'

interface VideoHeroProps {
  imageSrc: string
  headline: string
  subheadline?: string
  ctaText: string
  ctaHref: string
  secondaryCtaText?: string
  secondaryCtaHref?: string
  eyebrow?: string
}

export default function VideoHero({
  imageSrc,
  headline,
  subheadline,
  ctaText,
  ctaHref,
  secondaryCtaText,
  secondaryCtaHref,
  eyebrow,
}: VideoHeroProps) {
  return (
    <section className="relative min-h-[45svh] md:min-h-[48vh] flex items-end overflow-hidden bg-proton-black">
      {/* Background image */}
      <Image
        src={imageSrc}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-70"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-proton-black/80 via-proton-black/20 to-transparent" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 pb-8 md:pb-10">
        {eyebrow && (
          <p className="text-[10px] text-proton-white/60 uppercase tracking-widest mb-6">
            {eyebrow}
          </p>
        )}
        <h1 className="font-playfair text-proton-white text-5xl md:text-7xl lg:text-8xl leading-none max-w-4xl">
          {headline}
        </h1>
        {subheadline && (
          <p className="text-proton-white/70 text-base md:text-lg mt-4 max-w-lg leading-relaxed">
            {subheadline}
          </p>
        )}
        <div className="mt-6 md:mt-8 flex flex-wrap gap-3">
          <Button
            href={ctaHref}
            variant="secondary"
            size="lg"
            className="border-proton-white text-proton-white hover:bg-proton-white hover:text-proton-black"
          >
            {ctaText}
          </Button>
          {secondaryCtaText && secondaryCtaHref && (
            <Button
              href={secondaryCtaHref}
              variant="secondary"
              size="lg"
              className="border-proton-white text-proton-white hover:bg-proton-white hover:text-proton-black"
            >
              {secondaryCtaText}
            </Button>
          )}
        </div>
      </div>

      {/* Scroll indicator */}
      <div aria-hidden="true" className="absolute bottom-8 right-8 md:right-12 flex flex-col items-center gap-2 opacity-40">
        <span className="text-proton-white text-[10px] uppercase tracking-widest rotate-90 origin-center translate-y-4">
          Scroll
        </span>
        <div className="w-px h-12 bg-proton-white/50" />
      </div>
    </section>
  )
}
