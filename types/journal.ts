export interface JournalPost {
  id: string
  handle: string // slug
  title: string
  excerpt: string
  publishedAt: string // ISO date string
  author: {
    name: string
  }
  image: {
    url: string
    altText: string | null
  }
  tags: string[]
  content: string
  contentHtml?: string
}
