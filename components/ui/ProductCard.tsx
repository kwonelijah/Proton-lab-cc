import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/types/product'
import { formatPrice, inStockSizes } from '@/lib/utils'

interface ProductCardProps {
  product: Product
  priority?: boolean
  // 'shop' — the zero-gutter shop grid: cards touch, so the text is inset and
  //          the image is sized for a 25vw / 50vw column.
  // 'row'  — a gapped grid inside the page container (product page
  //          "Different Colour?" row): text sits flush with the image edge.
  variant?: 'shop' | 'row'
}

// 12px uppercase Montserrat with near-normal tracking: the shop card's
// deliberate exception to the site's tracking-widest labels. font-inter is
// required because globals.css gives every h3 Playfair.
export const CARD_LABEL = 'font-inter text-xs uppercase tracking-wide leading-4'

export default function ProductCard({ product, priority = false, variant = 'row' }: ProductCardProps) {
  const { amount, currencyCode } = product.priceRange.minVariantPrice
  const soldOut = !product.availableForSale
  const sizes = soldOut ? [] : inStockSizes(product)
  const imgSizes = variant === 'shop' ? '(max-width: 767px) 50vw, 25vw' : '(max-width: 767px) 50vw, 33vw'

  // Fixed 4:5 frame keeps every card the same height. Portrait photos fill it
  // edge-to-edge (cover); landscape photos (e.g. accessory flat-lays) would
  // crop badly, so they sit whole on the brand-light panel (contain) instead.
  const isLandscape = product.featuredImage.width > product.featuredImage.height
  const fit = isLandscape ? 'object-contain' : 'object-cover'

  // Second gallery image replaces the first on hover; products with a single
  // photo keep the plain card. The swap is the card's only hover effect.
  const hoverImage = product.images.nodes.find(
    (img) => img.url !== product.featuredImage.url
  )
  const hoverFit =
    hoverImage && hoverImage.width > hoverImage.height
      ? 'object-contain'
      : 'object-cover'

  return (
    <Link
      href={`/products/${product.handle}`}
      className="group block"
      aria-label={`${product.title}${soldOut ? ' — Sold Out' : ''}`}
    >
      <div className="relative overflow-hidden aspect-[4/5] bg-proton-light">
        <Image
          src={product.featuredImage.url}
          alt={product.featuredImage.altText ?? product.title}
          fill
          sizes={imgSizes}
          quality={90}
          className={`${fit} transition-opacity duration-300 ${hoverImage ? 'group-hover:opacity-0' : ''}`}
          priority={priority}
        />
        {hoverImage && (
          <Image
            src={hoverImage.url}
            alt={hoverImage.altText ?? product.title}
            fill
            sizes={imgSizes}
            quality={90}
            className={`${hoverFit} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
          />
        )}
      </div>

      {/* Text block: name left, price right on one line, sizes in stock
          below in grey; sold-out cards carry a black "Sold Out" line above
          the name instead of sizes. */}
      <div className={`pt-4 pb-2.5 ${variant === 'shop' ? 'px-4' : ''}`}>
        {soldOut && <p className={`${CARD_LABEL} text-proton-black`}>Sold Out</p>}
        <div className="flex items-start justify-between gap-x-3">
          <h3 className={`${CARD_LABEL} min-w-0 flex-1 text-proton-black group-hover:opacity-60 transition-opacity duration-200`}>
            {product.title}
          </h3>
          <p className={`${CARD_LABEL} shrink-0 text-right text-proton-grey`}>
            {formatPrice(amount, currencyCode)}
          </p>
        </div>
        {sizes.length > 0 && (
          <p className={`${CARD_LABEL} mt-1 flex flex-wrap gap-x-2 text-proton-grey`}>
            <span className="sr-only">Sizes in stock: </span>
            {sizes.map(s => (
              <span key={s}>{s}</span>
            ))}
          </p>
        )}
      </div>
    </Link>
  )
}
