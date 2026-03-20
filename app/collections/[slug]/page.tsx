import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PageWrapper from '@/components/layout/PageWrapper'
import ProductCard from '@/components/ui/ProductCard'
import { getCollections, getCollectionByHandle } from '@/lib/api'

interface PageProps {
  params: { slug: string }
}

export async function generateStaticParams() {
  const collections = await getCollections()
  return collections.map(c => ({ slug: c.handle }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const collection = await getCollectionByHandle(params.slug)
  if (!collection) return {}
  return {
    title: collection.title,
    description: collection.description,
  }
}

export default async function CollectionPage({ params }: PageProps) {
  const collection = await getCollectionByHandle(params.slug)
  if (!collection) notFound()

  return (
    <PageWrapper>
      {/* Collection hero */}
      {collection.image && (
        <div className="relative w-full aspect-[21/9] bg-proton-light overflow-hidden">
          <Image
            src={collection.image.url}
            alt={collection.image.altText ?? collection.title}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-proton-black/30" />
          <div className="absolute inset-0 flex items-end">
            <div className="max-w-7xl w-full mx-auto px-6 md:px-12 pb-10 md:pb-14">
              <p className="text-[10px] text-proton-white/60 uppercase tracking-widest mb-2">
                Collection
              </p>
              <h1 className="font-playfair text-4xl md:text-6xl text-proton-white leading-none">
                {collection.title}
              </h1>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 md:px-12">
        {/* Collection description */}
        <div className="py-12 md:py-16 max-w-2xl">
          {!collection.image && (
            <>
              <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">
                Collection
              </p>
              <h1 className="font-playfair text-5xl md:text-7xl leading-none mb-6">
                {collection.title}
              </h1>
            </>
          )}
          <p className="text-proton-grey leading-relaxed">
            {collection.description}
          </p>
        </div>

        {/* Breadcrumb */}
        <div className="mb-8 pb-8 border-b border-proton-light flex items-center justify-between">
          <Link
            href="/collections"
            className="text-[10px] text-proton-grey uppercase tracking-widest hover:text-proton-black transition-colors duration-200"
          >
            ← All Collections
          </Link>
          <p className="text-[10px] text-proton-grey uppercase tracking-widest">
            {collection.products.nodes.length} {collection.products.nodes.length === 1 ? 'piece' : 'pieces'}
          </p>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-12 pb-24 md:pb-32">
          {collection.products.nodes.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              priority={i < 4}
            />
          ))}
        </div>
      </div>
    </PageWrapper>
  )
}
