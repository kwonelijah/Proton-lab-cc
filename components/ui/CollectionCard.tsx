import Image from 'next/image'
import Link from 'next/link'
import type { Collection } from '@/types/collection'

interface CollectionCardProps {
  collection: Collection
  priority?: boolean
}

export default function CollectionCard({ collection, priority = false }: CollectionCardProps) {
  const productCount = collection.products.nodes.length

  return (
    <Link
      href={`/collections/${collection.handle}`}
      className="group block"
      aria-label={`Shop ${collection.title} — ${productCount} ${productCount === 1 ? 'piece' : 'pieces'}`}
    >
      {/* Image container */}
      <div className="relative overflow-hidden aspect-[3/2] bg-proton-light">
        {collection.image ? (
          <Image
            src={collection.image.url}
            alt={collection.image.altText ?? collection.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="absolute inset-0 bg-proton-mid" />
        )}
        <div className="absolute inset-0 bg-proton-black/20 group-hover:bg-proton-black/35 transition-colors duration-300" />

        {/* Overlay text */}
        <div className="absolute inset-0 flex flex-col justify-end p-6">
          <p className="text-[10px] text-proton-white/70 uppercase tracking-widest mb-1">
            {productCount} {productCount === 1 ? 'piece' : 'pieces'}
          </p>
          <h3 className="font-playfair text-2xl text-proton-white leading-tight">
            {collection.title}
          </h3>
        </div>
      </div>

      {/* Below-image description */}
      <div className="pt-3">
        <p className="text-sm text-proton-grey leading-relaxed line-clamp-2">
          {collection.description}
        </p>
        <span className="inline-block mt-3 text-xs uppercase tracking-widest text-proton-black border-b border-proton-black pb-0.5 group-hover:opacity-60 transition-opacity duration-200">
          Shop
        </span>
      </div>
    </Link>
  )
}
