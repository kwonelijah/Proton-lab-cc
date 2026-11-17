import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PageWrapper from '@/components/layout/PageWrapper'
import ProductGallery from './ProductGallery'
import VariantSelector from './VariantSelector'
import Accordion from '@/components/ui/Accordion'
import DeliveryNote from '@/components/ui/DeliveryNote'
import ProductCard, { CARD_LABEL } from '@/components/ui/ProductCard'
import { getProducts, getProductByHandle } from '@/lib/api'
import { getDisplayCurrency } from '@/lib/currency-server'
import { formatPrice } from '@/lib/utils'

interface PageProps {
  params: { slug: string }
}

// Hairline black dividers, as on /shop: bottom border on every cell, right
// border on every cell except the last column (2 on phones, 4 from md).
const CELL =
  'border-b border-proton-black [&:not(:nth-child(2n))]:border-r md:[&:not(:nth-child(4n))]:border-r'

// Fisher–Yates, returns a new array.
function shuffle<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export async function generateStaticParams() {
  const products = await getProducts()
  return products.map(p => ({ slug: p.handle }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const product = await getProductByHandle(params.slug)
  if (!product) return {}
  const title = product.seo?.title ?? product.title
  const description = product.seo?.description ?? product.description
  const image = {
    url: product.featuredImage.url,
    width: product.featuredImage.width,
    height: product.featuredImage.height,
    alt: product.featuredImage.altText ?? product.title,
  }
  return {
    title,
    description,
    keywords: product.seo?.keywords,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
  }
}

export default async function ProductPage({ params }: PageProps) {
  const currency = getDisplayCurrency()
  const product = await getProductByHandle(params.slug, currency)
  if (!product) notFound()

  const { amount, currencyCode } = product.priceRange.minVariantPrice

  // "Other Products": four of the other live products, picked at random on
  // every request (this route renders per request because of the currency
  // cookie), in the shop's full-bleed grid.
  const others = shuffle((await getProducts(currency)).filter(p => p.handle !== product.handle)).slice(0, 4)

  // Product details — the top-right cell of the full-bleed mosaic (UVU's
  // product layout, matching the shop and home grids). Title and price share
  // one 12px caps row like the product cards.
  const info = (
    <div className="space-y-8">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className={`flex items-center gap-2 ${CARD_LABEL} text-proton-grey`}>
              <Link href="/shop" className="hover:text-proton-black transition-colors duration-200">
                Shop
              </Link>
              <span>/</span>
              <span className="text-proton-black">{product.title}</span>
            </nav>

            {/* Title + price */}
            <div className="flex items-start justify-between gap-x-4">
              <h1 className={`${CARD_LABEL} min-w-0 flex-1 text-proton-black`}>
                {product.title}
              </h1>
              <p className={`${CARD_LABEL} shrink-0 text-right text-proton-grey md:font-bold md:text-sm md:text-proton-black`}>
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

            <DeliveryNote />

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
  )

  return (
    <PageWrapper>
      {/* Gallery shows the images array only — featuredImage is the card/hero
          shot and may not belong in the product gallery (e.g. Red Sky) */}
      <ProductGallery images={product.images.nodes} productTitle={product.title} info={info} />

      {/* Other Products — four random others in the shop's full-bleed grid */}
      {others.length > 0 && (
        <section aria-label="Other products">
          <h2 className={`${CARD_LABEL} text-center text-proton-black py-4`}>Other Products</h2>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-proton-black pb-10 md:pb-14">
            {others.map(p => (
              <li key={p.id} className={CELL}>
                <ProductCard product={p} variant="shop" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageWrapper>
  )
}
