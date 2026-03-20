import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PageWrapper from '@/components/layout/PageWrapper'
import { getJournalPosts, getJournalPostByHandle } from '@/lib/api'
import { formatDate } from '@/lib/utils'

interface PageProps {
  params: { slug: string }
}

export async function generateStaticParams() {
  const posts = await getJournalPosts()
  return posts.map(p => ({ slug: p.handle }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getJournalPostByHandle(params.slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.excerpt,
  }
}

export default async function JournalPostPage({ params }: PageProps) {
  const post = await getJournalPostByHandle(params.slug)
  if (!post) notFound()

  return (
    <PageWrapper>
      {/* Hero image */}
      <div className="relative w-full aspect-[21/9] bg-proton-light overflow-hidden">
        <Image
          src={post.image.url}
          alt={post.image.altText ?? post.title}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      </div>

      {/* Article */}
      <div className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24">
        {/* Breadcrumb */}
        <Link
          href="/journal"
          className="text-[10px] text-proton-grey uppercase tracking-widest hover:text-proton-black transition-colors duration-200 mb-8 block"
        >
          ← Journal
        </Link>

        {/* Meta */}
        <div className="mb-8">
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-3">
            {formatDate(post.publishedAt)} &nbsp;·&nbsp; {post.author.name}
          </p>
          <h1 className="font-playfair text-4xl md:text-5xl leading-tight">
            {post.title}
          </h1>
        </div>

        {/* Excerpt / lead */}
        <p className="text-lg text-proton-grey leading-relaxed border-l-2 border-proton-mid pl-5 mb-12 italic">
          {post.excerpt}
        </p>

        {/* Body */}
        <div className="space-y-6">
          {post.content.split('\n\n').map((paragraph, i) => (
            <p key={i} className="text-base text-proton-black leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mt-16 pt-8 border-t border-proton-light flex flex-wrap gap-2">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="text-[10px] uppercase tracking-widest text-proton-grey border border-proton-mid px-3 py-1"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
