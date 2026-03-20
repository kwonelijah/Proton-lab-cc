import Button from '@/components/ui/Button'

interface CTABannerProps {
  eyebrow?: string
  headline: string
  ctaText: string
  ctaHref: string
  inverted?: boolean
}

export default function CTABanner({
  eyebrow,
  headline,
  ctaText,
  ctaHref,
  inverted = false,
}: CTABannerProps) {
  return (
    <section
      className={`py-24 md:py-32 px-6 md:px-12 text-center ${
        inverted
          ? 'bg-proton-black text-proton-white'
          : 'bg-proton-light text-proton-black'
      }`}
    >
      <div className="max-w-4xl mx-auto">
        {eyebrow && (
          <p
            className={`text-[10px] uppercase tracking-widest mb-6 ${
              inverted ? 'text-proton-white/50' : 'text-proton-grey'
            }`}
          >
            {eyebrow}
          </p>
        )}
        <h2 className="font-playfair text-4xl md:text-5xl lg:text-6xl leading-tight mb-10">
          {headline}
        </h2>
        <Button
          href={ctaHref}
          variant="secondary"
          size="lg"
          className={
            inverted
              ? 'border-proton-white text-proton-white hover:bg-proton-white hover:text-proton-black'
              : ''
          }
        >
          {ctaText}
        </Button>
      </div>
    </section>
  )
}
