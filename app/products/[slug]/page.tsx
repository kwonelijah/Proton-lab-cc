import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PageWrapper from '@/components/layout/PageWrapper'
import ProductGallery from './ProductGallery'
import VariantSelector from './VariantSelector'
import Accordion from '@/components/ui/Accordion'
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
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-proton-grey mb-8">
          <Link href="/shop" className="hover:text-proton-black transition-colors duration-200">
            Shop
          </Link>
          <span>/</span>
          <span className="text-proton-black">{product.title}</span>
        </nav>

        {/* Main content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 lg:gap-20">
          {/* Gallery */}
          <ProductGallery
            images={[
              product.featuredImage,
              ...product.images.nodes.filter(img => img.url !== product.featuredImage.url),
            ]}
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
              productHandle={product.handle}
              productImage={product.featuredImage.url}
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

            {/* Size Guide accordion */}
            <Accordion title="Size Guide">
              <p className="text-xs text-proton-grey leading-relaxed mb-5">
                All measurements are in centimetres. Measure yourself and compare with the chart below. If you&apos;re between sizes, we recommend sizing up for a more relaxed fit.
              </p>
              {/* Men's size table — always shown */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-proton-light">
                      {['Size', 'Chest', 'Waist', 'Hip'].map(h => (
                        <th key={h} scope="col" className="pb-3 pr-6 text-[10px] uppercase tracking-widest text-proton-grey font-inter font-normal">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['XS', '84', '72', '87'],
                      ['S',  '88', '78', '93'],
                      ['M',  '92', '84', '99'],
                      ['L',  '96', '90', '105'],
                      ['XL', '100', '96', '111'],
                    ].map(([size, chest, waist, hip], i) => (
                      <tr key={size} className={`border-b border-proton-light/60 ${i % 2 === 1 ? 'bg-proton-light/30' : ''}`}>
                        <td className="py-2.5 pr-6 text-sm text-proton-black font-inter">{size}</td>
                        <td className="py-2.5 pr-6 text-sm text-proton-grey font-inter">{chest}</td>
                        <td className="py-2.5 pr-6 text-sm text-proton-grey font-inter">{waist}</td>
                        <td className="py-2.5 pr-6 text-sm text-proton-grey font-inter">{hip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Women's size table — hidden by default, enable via showWomens prop when needed */}
              {/* To enable: pass showWomens={true} to <Accordion> and wire it through as a prop */}
              {false && (
                <div className="overflow-x-auto mt-6">
                  <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-3">Women&apos;s</p>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-proton-light">
                        {['Size', 'Chest', 'Waist', 'Hip'].map(h => (
                          <th key={h} scope="col" className="pb-3 pr-6 text-[10px] uppercase tracking-widest text-proton-grey font-inter font-normal">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['XS', '82', '66', '90'],
                        ['S',  '86', '72', '96'],
                        ['M',  '90', '78', '102'],
                        ['L',  '94', '84', '108'],
                        ['XL', '98', '90', '114'],
                      ].map(([size, chest, waist, hip], i) => (
                        <tr key={size} className={`border-b border-proton-light/60 ${i % 2 === 1 ? 'bg-proton-light/30' : ''}`}>
                          <td className="py-2.5 pr-6 text-sm text-proton-black font-inter">{size}</td>
                          <td className="py-2.5 pr-6 text-sm text-proton-grey font-inter">{chest}</td>
                          <td className="py-2.5 pr-6 text-sm text-proton-grey font-inter">{waist}</td>
                          <td className="py-2.5 pr-6 text-sm text-proton-grey font-inter">{hip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Accordion>

            {/* Care & Washing accordion */}
            <Accordion title="Care & Washing">
              <ul className="space-y-2.5">
                {[
                  'Machine wash at 30°C in garment bag or handwash',
                  'Delicate cycle / Quick wash',
                  'Wash dark and bright colors separately',
                  'No synthetics wash / Do not bleach',
                  'Do not dry clean / Do not tumble dry / Do not iron',
                ].map((line, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-proton-grey">
                    <span className="mt-2 w-1 h-1 rounded-full bg-proton-grey shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
            </Accordion>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
