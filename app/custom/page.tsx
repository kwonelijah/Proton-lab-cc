import type { Metadata } from 'next'
import PageWrapper from '@/components/layout/PageWrapper'
import CTABanner from '@/components/sections/CTABanner'
import Button from '@/components/ui/Button'
import KitCarousel from '@/components/ui/KitCarousel'

const kitGallery = [
  { src: '/images/custom/gallery1.jpg', alt: 'Custom kit example 1' },
  { src: '/images/custom/gallery2.jpg', alt: 'Custom kit example 2' },
  { src: '/images/custom/gallery3.jpg', alt: 'Custom kit example 3' },
  { src: '/images/custom/gallery4.jpg', alt: 'Custom kit example 4' },
  { src: '/images/custom/gallery5.jpg', alt: 'Custom kit example 5' },
  { src: '/images/custom/gallery6.jpg', alt: 'Custom kit example 6' },
  { src: '/images/custom/gallery7.jpg', alt: 'Custom kit example 7' },
]

export const metadata: Metadata = {
  title: 'Custom Kit',
}

const categories = [
  {
    name: 'Jerseys',
    items: [
      { name: 'SS Race Jersey', price: '£80' },
      { name: 'SS Training Jersey', price: '£65' },
      { name: 'SS Club Jersey', price: '£50' },
      { name: 'SS Zipperless Jersey', price: '£65' },
      { name: 'LS Training Jersey', price: '£70' },
      { name: 'LS Fleece Jersey', price: '£85' },
      { name: 'MTB Jersey', price: '£30' },
    ],
  },
  {
    name: 'Shorts',
    items: [
      { name: 'Race Bib Shorts', price: '£90' },
      { name: 'Training Bib Shorts', price: '£80' },
      { name: 'Club Bib Shorts', price: '£65' },
      { name: 'Training Bib Tights', price: '£110' },
    ],
  },
  {
    name: 'Jackets & Gilets',
    items: [
      { name: 'Winter Jacket', price: '£100' },
      { name: 'Summer Gilet', price: '£55' },
      { name: 'Winter Gilet', price: '£70' },
    ],
  },
  {
    name: 'Skinsuits',
    items: [
      { name: 'SS Roadsuit', price: '£120' },
      { name: 'SS Aerosuit', price: '£140' },
      { name: 'LS Speedsuit', price: '£150' },
      { name: 'SS Trisuit', price: '£135' },
      { name: 'Sleeveless Trisuit', price: '£135' },
    ],
  },
  {
    name: 'Accessories',
    items: [
      { name: 'Aero Socks', price: '£20' },
      { name: 'Aero Mitts', price: '£25' },
      { name: 'Aero Arm Warmers', price: '£25' },
      { name: 'Knee Warmers', price: '£25' },
      { name: 'Leg Warmers', price: '£25' },
      { name: 'Training Mitts', price: '£20' },
      { name: 'Arm Warmers', price: '£20' },
      { name: 'Buff', price: '£10' },
      { name: 'Cycling Cap', price: '£10' },
    ],
  },
]

const process = [
  { step: '01', title: 'Enquire', description: 'Tell us about your club, team size, and what you need. We\'ll come back to you within 48 hours.' },
  { step: '02', title: 'Design', description: 'Our team works with you to develop a kit identity. We handle the design process from brief to approval.' },
  { step: '03', title: 'Order', description: 'Minimum order quantity of 5 pieces. Accessories require MOQ 10+. Individual items available at 50% surcharge.' },
  { step: '04', title: 'Deliver', description: 'Production and delivery to your door. Typical lead time 4–6 weeks from design approval.' },
]

export default function CustomPage() {
  return (
    <PageWrapper noPadding>
      {/* Hero */}
      <div className="relative min-h-screen bg-proton-black overflow-hidden flex items-end">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        >
          <source src="https://zpwxsatldyroswl1.public.blob.vercel-storage.com/PLCustomHomepageClip.mov" type="video/quicktime" />
          <source src="https://zpwxsatldyroswl1.public.blob.vercel-storage.com/PLCustomHomepageClip.mov" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-proton-black/80 via-proton-black/20 to-transparent" />
        <div className="relative z-10 max-w-7xl w-full mx-auto px-6 md:px-12 pb-12 md:pb-16">
          <p className="text-[10px] text-proton-white/60 uppercase tracking-widest mb-3">
            Custom Kit
          </p>
          <h1 className="font-playfair text-5xl md:text-7xl text-proton-white leading-none max-w-2xl">
            Your Identity.<br />Your Design.
          </h1>
        </div>
      </div>

      {/* Intro */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-start">
          <div>
            <p className="font-playfair text-2xl md:text-3xl leading-snug">
              Full custom kit for clubs and teams. Custom design to the highest standards.
            </p>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-proton-grey leading-relaxed">
              We produce custom cycling apparel for cycling clubs, race teams, corporate groups and events. Every garment is made to order with your branding, colours and design. Our Designers bring your ideas and concepts to life.
            </p>
            <p className="text-sm text-proton-grey leading-relaxed">
              5+ item MOQ available across most garments, request pricing for individual pieces.
            </p>
            <div className="pt-4">
              <Button href="/contact" variant="primary" size="lg">
                Start Your Enquiry
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Process */}
      <div className="border-t border-proton-light py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-12">
            How It Works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {process.map(step => (
              <div key={step.step}>
                <p className="font-playfair text-4xl text-proton-black mb-4">{step.step}</p>
                <h3 className="font-inter text-xs uppercase tracking-widest text-proton-black mb-3">{step.title}</h3>
                <p className="text-sm text-proton-grey leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricelist */}
      <div className="border-t border-proton-light py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <h2 className="font-playfair text-4xl md:text-5xl leading-none">
                Pricing
              </h2>
            </div>
          </div>

          <div className="space-y-0">
            {categories.map((cat, ci) => (
              <div key={cat.name} className={`border-t border-proton-light ${ci === categories.length - 1 ? 'border-b' : ''}`}>
                {/* Category header */}
                <div className="py-5">
                  <p className="text-[10px] uppercase tracking-widest text-proton-grey">{cat.name}</p>
                </div>
                {/* Items */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 pb-6">
                  {cat.items.map(item => (
                    <div key={item.name} className="flex justify-between items-center py-3 border-t border-proton-light/60 pr-8">
                      <span className="text-sm text-proton-black">{item.name}</span>
                      <span className="text-sm font-inter text-proton-black ml-4 shrink-0">{item.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team store teaser */}
      <div className="border-t border-proton-light py-16 md:py-20 bg-proton-light">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div>
            <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-3">
              Club Shops
            </p>
            <h2 className="font-playfair text-3xl md:text-4xl leading-tight max-w-lg">
              Private team stores — order, reorder, and manage your club kit online.
            </h2>
          </div>
          <Button href="/custom/club" variant="secondary" size="lg">
            Order Kit
          </Button>
        </div>
      </div>

      <KitCarousel images={kitGallery} />

      <CTABanner
        headline="Ready to get started?"
        ctaText="Contact Us"
        ctaHref="/contact"
        inverted
      />
    </PageWrapper>
  )
}
