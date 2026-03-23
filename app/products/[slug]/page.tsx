import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PageWrapper from '@/components/layout/PageWrapper'
import ProductGallery from './ProductGallery'
import VariantSelector from './VariantSelector'
import { getProducts, getProductByHandle } from '@/lib/api'
import { formatPrice } from '@/lib/utils'

interface PageProps {
  params: { slug: string }
}

export async function generateStaticParams() {
  const products = await getProducts()
  return products.map(p => ({ slug: p.handle }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const product = await getProductByHandle(params.slug)
  if (!product) return {}
  return {
    title: product.seo?.title ?? product.title,
    description: product.seo?.description ?? product.description,
    keywords: product.seo?.keywords,
  }
}

export default async function ProductPage({ params }: PageProps) {
  const product = await getProductByHandle(params.slug)
  if (!product) notFound()

  const collectionRef = product.collections?.nodes[0]
  const { amount, currencyCode } = product.priceRange.minVariantPrice

  return (
    <PageWrapper>
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 md:py-16">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-proton-grey mb-8">
          <Link href="/collections" className="hover:text-proton-black transition-colors duration-200">
            Collections
          </Link>
          {collectionRef && (
            <>
              <span>/</span>
              <Link
                href={`/collections/${collectionRef.handle}`}
                className="hover:text-proton-black transition-colors duration-200"
              >
                {collectionRef.title}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-proton-black">{product.title}</span>
        </nav>

        {/* Main content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 lg:gap-20">
          {/* Gallery */}
          <ProductGallery
            images={product.images.nodes}
            productTitle={product.title}
          />

          {/* Product details */}
          <div className="md:sticky md:top-24 md:self-start space-y-8">
            {/* Title + price */}
            <div>
              {collectionRef && (
                <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-2">
                  {collectionRef.title}
                </p>
              )}
              <h1 className="font-playfair text-3xl md:text-4xl leading-tight mb-4">
                {product.title}
              </h1>
              <p className="text-xl text-proton-black">
                {formatPrice(amount, currencyCode)}
              </p>
            </div>

            {/* Variant selector + Add to cart */}
            <VariantSelector
              variants={product.variants.nodes}
              productTitle={product.title}
            />

            {/* Description */}
            <div className="pt-4 border-t border-proton-light">
              <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">
                Description
              </p>
              <p className="text-sm text-proton-black leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Bullets */}
            {product.bullets && product.bullets.length > 0 && (
              <div className="pt-4 border-t border-proton-light">
                <ul className="space-y-2">
                  {product.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-proton-black">
                      <span className="mt-2 w-1 h-1 rounded-full bg-proton-black shrink-0" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
