import Image from 'next/image'
import Link from 'next/link'
import type { JournalPost } from '@/types/journal'

interface JournalCardProps {
  post: JournalPost
  featured?: boolean
  priority?: boolean
}

export default function JournalCard({ post, featured = false, priority = false }: JournalCardProps) {
  if (featured) {
    return (
      <article>
      <Link href={`/journal/${post.handle}`} className="group grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="relative overflow-hidden aspect-[3/2] bg-proton-light">
          <Image
            src={post.image.url}
            alt={post.image.altText ?? post.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
          />
        </div>
        <div>
          <h2 className="font-playfair text-3xl md:text-4xl text-proton-black leading-tight mb-4 group-hover:opacity-70 transition-opacity duration-200">
            {post.title}
          </h2>
          <p className="text-sm text-proton-grey leading-relaxed mb-6">
            {post.excerpt}
          </p>
          <span className="text-xs uppercase tracking-widest text-proton-black border-b border-proton-black pb-0.5">
            Read Article
          </span>
        </div>
      </Link>
      </article>
    )
  }

  return (
    <article>
    <Link href={`/journal/${post.handle}`} className="group block">
      <div className="relative overflow-hidden aspect-[3/2] bg-proton-light mb-4">
        <Image
          src={post.image.url}
          alt={post.image.altText ?? post.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          priority={priority}
        />
      </div>
      <h3 className="font-playfair text-xl text-proton-black leading-snug mb-2 group-hover:opacity-70 transition-opacity duration-200">
        {post.title}
      </h3>
      <p className="text-sm text-proton-grey leading-relaxed line-clamp-3">
        {post.excerpt}
      </p>
    </Link>
    </article>
  )
}
