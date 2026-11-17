import Image from 'next/image'
import type { ReactNode } from 'react'
import type { ProductImage } from '@/types/product'
import MobileGallery from './MobileGallery'

interface ProductGalleryProps {
  images: ProductImage[]
  productTitle: string
  // The product details panel.
  info: ReactNode
}

const CELL = 'relative overflow-hidden aspect-[4/5] bg-proton-light border-b border-proton-black'

// Full-bleed product layout with hairline black dividers and no page gutters.
// Desktop: the photos fill the left two thirds as a two-up 4:5 grid that
// scrolls with the page; the details sit in the right third and stay put
// (sticky under the navbar for the height of the photo grid). Phones: the
// previous gallery (main photo + thumbnails) filling the screen width, then
// the details. Portrait photos cover their cell; landscape ones sit whole.
export default function ProductGallery({ images, productTitle, info }: ProductGalleryProps) {
  const fit = (img: ProductImage) => (img.width > img.height ? 'object-contain' : 'object-cover')
  // Desktop: the container draws one bottom line across the full width (photos
  // and details), so the last row of photos drops its own to avoid doubling.
  const lastRowStart = images.length - (images.length % 2 === 0 ? 2 : 1)

  return (
    <div className="border-t md:border-b border-proton-black md:grid md:grid-cols-3">
      <MobileGallery images={images} productTitle={productTitle} />

      {/* Desktop two-up grid — display:none on phones, where `sizes` collapses
          to 1px so the eager first photos cost nothing. */}
      <div className="hidden md:grid grid-cols-2 md:col-start-1 md:col-end-3 md:row-start-1 md:border-r border-proton-black">
        {images.map((img, k) => (
          <div key={img.id} className={`${CELL} ${k % 2 === 0 ? 'border-r' : ''} ${k >= lastRowStart ? 'md:border-b-0' : ''}`}>
            <Image
              src={img.url}
              alt={img.altText ?? `${productTitle} image ${k + 1}`}
              fill
              sizes="(max-width: 767px) 1px, 33vw"
              quality={90}
              className={fit(img)}
              priority={k < 2}
            />
          </div>
        ))}
      </div>

      {/* Details */}
      <div className="md:col-start-3 md:row-start-1 md:sticky md:top-20 md:self-start border-t md:border-t-0 border-b md:border-b-0 border-proton-black px-6 md:px-10 py-8 md:py-10">
        {info}
      </div>
    </div>
  )
}
