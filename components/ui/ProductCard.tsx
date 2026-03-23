import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/types/product'
import { formatPrice } from '@/lib/utils'

interface ProductCardProps {
  product: Product
  priority?: boolean
}

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const collectionTitle = product.collections?.nodes[0]?.title
  const { amount, currencyCode } = product.priceRange.minVariantPrice

  return (
    <Link href={`/products/${product.handle}`} className="group block">
      {/* Image container */}
      <div className="relative overflow-hidden aspect-[4/5] bg-proton-light">
        <Image
          src={product.featuredImage.url}
          alt={product.featuredImage.altText ?? product.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-contain transition-opacity duration-300 group-hover:opacity-90"
          priority={priority}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-proton-black/0 group-hover:bg-proton-black/8 transition-colors duration-300" />

        {/* Out of stock badge */}
        {!product.availableForSale && (
          <div className="absolute top-3 left-3 bg-proton-white text-proton-black text-[10px] uppercase tracking-widest px-2 py-1">
            Sold Out
          </div>
        )}
      </div>

      {/* Card details */}
      <div className="pt-3 pb-1">
        {collectionTitle && (
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-1">
            {collectionTitle}
          </p>
        )}
        <h3 className="font-inter text-sm text-proton-black leading-snug group-hover:opacity-60 transition-opacity duration-200">
          {product.title}
        </h3>
        <p className="text-sm text-proton-grey mt-1">
          {formatPrice(amount, currencyCode)}
        </p>
      </div>
    </Link>
  )
}
