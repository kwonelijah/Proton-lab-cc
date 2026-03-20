import PageWrapper from '@/components/layout/PageWrapper'
import Button from '@/components/ui/Button'

export default function NotFound() {
  return (
    <PageWrapper>
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-40 text-center">
        <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">404</p>
        <h1 className="font-playfair text-5xl md:text-7xl leading-none mb-6">
          Page Not Found
        </h1>
        <p className="text-proton-grey mb-10 max-w-sm mx-auto">
          The page you are looking for does not exist or has been moved.
        </p>
        <Button href="/" variant="primary" size="lg">
          Back to Home
        </Button>
      </div>
    </PageWrapper>
  )
}
