import type { Metadata } from 'next'
import PageWrapper from '@/components/layout/PageWrapper'
import JournalCard from '@/components/ui/JournalCard'
import { getJournalPosts } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Journal',
}

export default async function JournalPage() {
  const posts = await getJournalPosts()
  const [featured, ...rest] = posts

  return (
    <PageWrapper>
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
        {/* Header */}
        <div className="mb-16 md:mb-20">
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">
            Stories & Insight
          </p>
          <h1 className="font-playfair text-5xl md:text-7xl leading-none">Journal</h1>
        </div>

        {/* Featured post */}
        {featured && (
          <div className="mb-16 md:mb-24 pb-16 md:pb-24 border-b border-proton-light">
            <JournalCard post={featured} featured priority />
          </div>
        )}

        {/* Remaining posts */}
        {rest.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 md:gap-8">
            {rest.map((post, i) => (
              <JournalCard key={post.id} post={post} priority={i === 0} />
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
