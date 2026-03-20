import type { Metadata } from 'next'
import PageWrapper from '@/components/layout/PageWrapper'
import Button from '@/components/ui/Button'

interface PageProps {
  params: { team: string }
}

export function generateMetadata({ params }: PageProps): Metadata {
  return {
    title: `Team Store — ${params.team}`,
  }
}

export default function TeamStorePage({ params }: PageProps) {
  const teamName = params.team
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <PageWrapper>
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-40 text-center">
        <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">
          Team Store
        </p>
        <h1 className="font-playfair text-5xl md:text-7xl leading-none mb-6">
          {teamName}
        </h1>
        <p className="text-proton-grey max-w-md mx-auto leading-relaxed mb-10">
          This team store is coming soon. Authentication and custom collections
          will be available when the team portal launches.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button href="/collections" variant="primary" size="lg">
            Browse Collections
          </Button>
          <Button href="/contact" variant="secondary" size="lg">
            Team Enquiry
          </Button>
        </div>
      </div>
    </PageWrapper>
  )
}
