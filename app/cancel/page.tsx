import Link from 'next/link'
import PageWrapper from '@/components/layout/PageWrapper'

export default function CancelPage() {
  return (
    <PageWrapper>
      <div className="max-w-lg mx-auto px-6 py-32 text-center">
        <p className="font-playfair text-4xl text-proton-black mb-4">Payment cancelled.</p>
        <p className="text-sm text-proton-grey leading-relaxed mb-10">
          Your order wasn&apos;t completed. No charge was made.
        </p>
        <Link
          href="/shop"
          className="text-[10px] uppercase tracking-widest text-proton-grey underline underline-offset-4 hover:text-proton-black transition-colors duration-200"
        >
          Return to Shop
        </Link>
      </div>
    </PageWrapper>
  )
}
