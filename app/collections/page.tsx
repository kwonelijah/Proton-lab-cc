import type { Metadata } from 'next'
import PageWrapper from '@/components/layout/PageWrapper'
import CollectionCard from '@/components/ui/CollectionCard'
import { getCollections } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Collections',
}

export default async function CollectionsPage() {
  const collections = await getCollections()

  return (
    <PageWrapper>
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
        {/* Header */}
        <div className="mb-16 md:mb-20">
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">
            All Collections
          </p>
          <h1 className="font-playfair text-5xl md:text-7xl leading-none">Collections</h1>
          <p className="mt-6 text-proton-grey max-w-xl leading-relaxed">
            Three lines, one standard. Whether you race, ride long, or train hard — there is a
            Proton Lab collection built for the way you ride.
          </p>
        </div>

        {/* Collections grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {collections.map((collection, i) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              priority={i < 3}
            />
          ))}
        </div>
      </div>
    </PageWrapper>
  )
}
