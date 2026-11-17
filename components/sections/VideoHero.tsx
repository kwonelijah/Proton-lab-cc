import Image, { getImageProps } from 'next/image'
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
  // Full-screen bleed with only the two buttons showing, equal-sized and
  // centred (homepage, 2026-11-17). The headline stays in the DOM as the
  // page's h1 for screen readers and search; subheadline/eyebrow are dropped.
  minimal?: boolean
  // Optional art-directed photo for phones (below the md breakpoint); the
  // browser downloads only the one that matches, via <picture>.
  mobileImageSrc?: string
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
}: VideoHeroProps) {
  if (minimal) {
    return (
      <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden bg-proton-black">
        <HeroImage src={imageSrc} mobileSrc={mobileImageSrc} />
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

// Background photo. With a phone-specific source it renders a <picture> built
// from next/image's own srcSets (getImageProps), so phones fetch only the
// portrait photo and larger screens only the landscape one.
function HeroImage({ src, mobileSrc }: { src: string; mobileSrc?: string }) {
  const common = { alt: '', fill: true, priority: true, sizes: '100vw', className: 'object-cover opacity-70' }
  if (!mobileSrc) return <Image src={src} {...common} />
  const { props: { srcSet: mobileSrcSet } } = getImageProps({ ...common, src: mobileSrc })
  const { props: desktop } = getImageProps({ ...common, src })
  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={mobileSrcSet} sizes="100vw" />
      <img {...desktop} alt="" />
    </picture>
  )
}
