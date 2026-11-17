import Image from 'next/image'
import Button from '@/components/ui/Button'
import HeroRotator from './HeroRotator'

interface VideoHeroProps {
  imageSrc: string
  headline: string
  subheadline?: string
  ctaText: string
  ctaHref: string
  secondaryCtaText?: string
  secondaryCtaHref?: string
  eyebrow?: string
  // Full-screen bleed with only the two buttons showing, equal-sized and
  // centred (homepage, 2026-11-17). The headline stays in the DOM as the
  // page's h1 for screen readers and search; subheadline/eyebrow are dropped.
  minimal?: boolean
  // Optional art-directed photo for phones (below the md breakpoint).
  mobileImageSrc?: string
  // Optional further photos: on md and up the hero rotates through imageSrc
  // then these, crossfading every 8 seconds.
  rotateSrcs?: string[]
  // Same for phones: mobileImageSrc then these.
  mobileRotateSrcs?: string[]
}

const BUTTON = 'border-proton-white text-proton-white hover:bg-proton-white hover:text-proton-black'

export default function VideoHero({
  imageSrc,
  headline,
  subheadline,
  ctaText,
  ctaHref,
  secondaryCtaText,
  secondaryCtaHref,
  eyebrow,
  minimal = false,
  mobileImageSrc,
  rotateSrcs = [],
  mobileRotateSrcs = [],
}: VideoHeroProps) {
  if (minimal) {
    return (
      <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden bg-proton-black">
        <HeroImage src={imageSrc} mobileSrc={mobileImageSrc} rotateSrcs={rotateSrcs} mobileRotateSrcs={mobileRotateSrcs} />
        <div className="absolute inset-0 bg-proton-black/25" />
        <h1 className="sr-only">{headline}</h1>
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4 px-6">
          <Button href={ctaHref} variant="secondary" size="lg" className={`${BUTTON} w-64`}>
            {ctaText}
          </Button>
          {secondaryCtaText && secondaryCtaHref && (
            <Button href={secondaryCtaHref} variant="secondary" size="lg" className={`${BUTTON} w-64`}>
              {secondaryCtaText}
            </Button>
          )}
        </div>
      </section>
    )
  }

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
          <Button href={ctaHref} variant="secondary" size="lg" className={BUTTON}>
            {ctaText}
          </Button>
          {secondaryCtaText && secondaryCtaHref && (
            <Button href={secondaryCtaHref} variant="secondary" size="lg" className={BUTTON}>
              {secondaryCtaText}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

// Background photo(s). Phones get the portrait photo (hidden from md up, where
// its `sizes` collapses to 1px so it costs nothing); larger screens get the
// landscape photo, rotating through `rotateSrcs` when given. Without a phone
// photo the single landscape image serves every width.
function HeroImage({ src, mobileSrc, rotateSrcs, mobileRotateSrcs }: { src: string; mobileSrc?: string; rotateSrcs: string[]; mobileRotateSrcs: string[] }) {
  const desktopSrcs = [src, ...rotateSrcs]
  if (!mobileSrc && desktopSrcs.length === 1) {
    return <Image src={src} alt="" fill priority sizes="100vw" className="object-cover opacity-70" />
  }
  return (
    <>
      {mobileSrc && (
        <div className="absolute inset-0 md:hidden">
          <HeroRotator srcs={[mobileSrc, ...mobileRotateSrcs]} sizes="(max-width: 767px) 100vw, 1px" />
        </div>
      )}
      <div className={`absolute inset-0 ${mobileSrc ? 'hidden md:block' : ''}`}>
        <HeroRotator srcs={desktopSrcs} />
      </div>
    </>
  )
}
